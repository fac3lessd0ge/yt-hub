# TLS Strategy

## Decision

TLS is terminated at the network edge by Traefik. yt-api listens on plain HTTP
internally. The Docker Compose internal network is trusted.

## Rationale

- The Docker bridge network is not externally routable.
- Traefik provides automatic Let's Encrypt certificate renewal via ACME.
- Adding TLS inside the application container adds operational complexity without
  security benefit when the internal network is trusted.

## Production Configuration

Traefik v3 reverse proxy handles:
- HTTP → HTTPS redirect (port 80 → 443)
- Automatic certificate provisioning via Let's Encrypt ACME HTTP-01 challenge
- Routing: `api.yourdomain.com` → `yt-api:3000`
- yt-api port 3000 is NOT exposed directly to the host; only Traefik is

Traefik is configured in `docker-compose.prod.yml` (single-host) and `docker-compose.prod.vm1.yml` (two-VM edge). Static and dynamic config live under `traefik/`. ACME storage is a host bind-mounted `traefik/acme.json` (mode `600`).

## Development Configuration

No TLS required. Use HTTP on localhost. CORS is configured to allow
`http://localhost:5173` and `http://localhost:3000` by default.

## gRPC Internal Communication

yt-api ↔ yt-service gRPC channel is Docker-internal plaintext. mTLS is not
required while both services run in the same Docker Compose network. If services
are ever split across hosts, add mTLS via tonic's TLS support.

## IP Address Forwarding

When Traefik is the edge proxy, the real client IP is in the `X-Forwarded-For`
header. yt-api's rate limiter uses `tower_governor`'s `SmartIpKeyExtractor`,
which reads `X-Forwarded-For` (and `Forwarded`) before falling back to the
connection socket address — so per-IP rate limits apply to the real client
behind Traefik, not to Traefik itself. No additional configuration is required
as long as Traefik is the first hop; if another proxy is chained in front of
Traefik, ensure it also forwards `X-Forwarded-For`.

## Certificate Management

| Environment | Certificate | Provider |
|-------------|------------|---------|
| Production | Automatic TLS | Let's Encrypt via Traefik ACME |
| Staging | Self-signed | Manual or Traefik self-signed |
| Development | None (HTTP) | N/A |
