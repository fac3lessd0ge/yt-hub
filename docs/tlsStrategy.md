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

Traefik reverse proxy (configured in Epic 11) handles:
- HTTP → HTTPS redirect (port 80 → 443)
- Automatic certificate provisioning via Let's Encrypt ACME HTTP-01 challenge
- Routing: `api.yourdomain.com` → `yt-api:3000`
- yt-api port 3000 is NOT exposed directly to the host; only Traefik is

## Development Configuration

No TLS required. Use HTTP on localhost. CORS is configured to allow
`http://localhost:5173` and `http://localhost:3000` by default.

## gRPC Internal Communication

yt-api ↔ yt-service gRPC channel is Docker-internal plaintext. mTLS is not
required while both services run in the same Docker Compose network. If services
are ever split across hosts, add mTLS via tonic's TLS support.

## IP Address Forwarding

When Traefik is the edge proxy, the real client IP is in the `X-Forwarded-For`
header. The yt-api rate limiter currently uses `ConnectInfo<SocketAddr>` (the
direct connection IP, which would be Traefik's IP). When Traefik is deployed,
update the rate limiter key extractor to read from `X-Forwarded-For`.

## Certificate Management

| Environment | Certificate | Provider |
|-------------|------------|---------|
| Production | Automatic TLS | Let's Encrypt via Traefik ACME |
| Staging | Self-signed | Manual or Traefik self-signed |
| Development | None (HTTP) | N/A |
