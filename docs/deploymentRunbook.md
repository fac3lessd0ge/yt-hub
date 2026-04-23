# Production Deployment Runbook

This runbook covers:
- single-host deployment (legacy-compatible)
- two-VM deployment (VM1 public edge + VM2 internal downloader)
- automated CD deploy/rollback from GitHub Actions

---

## 1. Prerequisites

### VPS Requirements

| Resource | Minimum |
|----------|---------|
| CPU | 1 vCPU |
| RAM | 1 GB |
| Disk | 10 GB |
| OS | Ubuntu 22.04 LTS (recommended) |

For two-VM setup, apply these minimums per VM. VM2 should usually have more CPU/RAM for yt-dlp/ffmpeg workloads.

### Required Software

- **Docker Engine** 24+
- **Docker Compose plugin** v2 (`docker compose` not `docker-compose`)
- **curl** (used by the healthcheck and deploy script)
- **git**

Install Docker on Ubuntu 22.04:

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

### DNS

Before the first deploy, create an **A record** pointing `api.DOMAIN` to VM1 public IP. Let's Encrypt's HTTP challenge requires DNS to be resolving before certificate issuance.

### Firewall

Open inbound ports:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (VM1 only, redirects to HTTPS) |
| 443 | TCP | HTTPS (VM1 only) |
| 50051 | TCP | gRPC (VM2; private network / VM1 only) |
| 8081 | TCP | Internal HTTP (VM2; private network / VM1 only) |

### Container Registry

Images are stored in the GitHub Container Registry (ghcr.io). If the packages are private, authenticate before pulling:

```bash
echo $GHCR_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

The automated CD pipeline (see §5) runs this login step on the target VM before each `docker compose pull`, using the `GHCR_USERNAME` / `GHCR_PAT` GitHub secrets — so manual login on the VM is only needed for out-of-band debugging.

### Security model (two-VM / internal HTTP)

- **Shared secret:** `INTERNAL_API_KEY` is required by both VM1 (`yt-api`, remote file mode) and VM2 (`yt-service` internal HTTP). Treat it like a service credential: generate a long random value, store it only in env files or a secrets manager, and never log it or commit it.
- **`FILE_DELIVERY_MODE=remote` required on both VMs.** On VM1 (`yt-api`) it enables the proxy to VM2's internal HTTP. On VM2 (`yt-service`) it enables the `/internal/files/*` route that the VM1 proxy depends on. If VM2 is left as `local` (default), VM1 file fetches return a misleading `FILE_NOT_FOUND` 404 — actual root cause is the route being disabled on VM2. Both `.env.prod.vm1` and `.env.prod.vm2` must set it explicitly.
- **Scope:** Internal routes (`/internal/health`, `/internal/files/...`) are authenticated with that header. Public traffic should only hit VM1 (Traefik + `yt-api`). VM2 should not expose application ports on a public interface.
- **Network:** Prefer private connectivity from VM1 to VM2 for gRPC and internal HTTP. If you must publish ports on VM2, restrict them with firewall rules to VM1’s address or your VPC CIDR.
- **Rate limiting:** The internal file route applies per-IP rate limiting on VM2 to reduce abuse if the port is ever reachable beyond VM1.

### VM2 host port binding (production)

`docker-compose.prod.vm2.yml` publishes gRPC and internal HTTP on **127.0.0.1** on the host by default (`127.0.0.1:${VM2_GRPC_BIND}:50051`, same for `8081`). That keeps them off the public NIC while still allowing **SSH port forwarding** or **private network** access from VM1.

If you change the bind to `0.0.0.0` (or drop the `127.0.0.1` prefix), anyone who can reach those ports on the host can attempt to speak gRPC or hit internal HTTP. Only do that inside a trusted private network and with firewall rules you have explicitly validated.

### Version skew and rollout order

Images for VM1 and VM2 should normally run the **same release tag**. Deploy **VM2 first, then VM1** so VM1 never calls an internal HTTP contract that the VM2 image does not yet implement. For rollbacks, prefer **VM1 first, then VM2** (reverse order) to avoid a window where a newer VM2 is paired with an older VM1, unless you accept that temporary mismatch.

---

## 2. First-Time VPS Setup

Follow these steps in order on a fresh VPS.

For two-VM mode, repeat setup on both VMs and use the VM-specific env/compose files.

> **Note:** Starting with v1.3.3, the automated CD pipeline syncs `scripts/` and the VM-specific `docker-compose.prod.vm*.yml` to the target VM over SCP before each deploy/rollback, so the VM itself does not need a pre-cloned repo. You still need the env file (`.env.prod.vm1` / `.env.prod.vm2`) on the VM at `VM*_DEPLOY_PATH`. A manual `git clone` is only required for out-of-band debugging or fully manual deploys.

**Step 1 — Clone the repository (manual-deploy path only):**

```bash
git clone https://github.com/fac3lessd0ge/yt-hub.git
cd yt-hub
```

**Step 2 — Create and edit environment file(s):**

```bash
cp .env.prod.example .env.prod
cp .env.prod.vm1.example .env.prod.vm1
cp .env.prod.vm2.example .env.prod.vm2
nano .env.prod.vm1
nano .env.prod.vm2
```

Fill in real values (`DOMAIN`, `LETSENCRYPT_EMAIL`, VM2 private addresses, shared `INTERNAL_API_KEY`). Never commit real env files.

**Step 3 — Prepare the ACME storage file:**

```bash
touch traefik/acme.json
chmod 600 traefik/acme.json
```

Traefik requires this file to exist with permissions `600` before startup. If the file is missing or has wrong permissions, certificate issuance will fail.

**Step 4 — Deploy:**

```bash
# Single host fallback:
bash scripts/deploy.sh

# Two-VM rollout:
# 1) VM2 first
VERSION=v1.3.3 bash scripts/deploy-vm2.sh
# 2) VM1 second
VERSION=v1.3.3 bash scripts/deploy-vm1.sh
```

Two-VM scripts pull prebuilt images, recreate only target services, and wait for health checks.

**Step 5 — Verify:**

```bash
curl -I https://api.DOMAIN/health
```

Expected response: `HTTP/2 200`.

---

## 3. Deploying a New Version

```bash
VERSION=v1.3.3 bash scripts/deploy.sh
```

The deploy script:
1. Pulls the specified image tags for all services.
2. Recreates containers with `--remove-orphans`.
3. Polls `yt-api`'s Docker health status until `healthy` or 60-second timeout.
4. Exits non-zero on failure so the calling shell or CI pipeline captures the error.

Two-VM explicit deploy:

```bash
# VM2 -> VM1 order is required
VERSION=v1.3.3 bash scripts/deploy-vm2.sh
VERSION=v1.3.3 bash scripts/deploy-vm1.sh
```

---

## 4. Rolling Back

```bash
bash scripts/rollback.sh v1.3.2
```

The rollback script targets only `yt-api` and `yt-service` (Traefik is not restarted). It:
1. Pulls the specified version for both services.
2. Recreates them with `--no-deps` to avoid touching Traefik.
3. Waits for `yt-api` to become healthy before returning success.

Two-VM rollback:

```bash
bash scripts/rollback-vm2.sh v1.3.2
bash scripts/rollback-vm1.sh v1.3.2
```

## 5. GitHub Actions CD (automatic deploy)

`cd.yml` does:
1. **Preflight**: resolves and prints `version` / `deploy_mode` / `deploy_target`, validates the version tag matches `vMAJOR.MINOR.PATCH`, checks all required secrets (SSH + GHCR), and opens a **TCP probe** to each VM's SSH port (dry-run reachability).
2. On tag push (`v*.*.*`), waits for the **ci** check to complete successfully on the tagged commit (uses the Checks API on the PR head for merge commits), then builds `yt-api` and `yt-service` images on the GitHub runner and pushes them to GHCR.
3. Syncs `scripts/` and the VM-specific `docker-compose.prod.vm*.yml` to the target VM over SCP, then runs the deploy/rollback script over SSH via the reusable workflow `.github/workflows/reusable-ssh-exec.yml`. The remote step performs a `docker login ghcr.io` with `GHCR_USERNAME`/`GHCR_PAT` before `docker compose pull`. The runner never builds on the VPS.
4. Deploy order: **VM2 → VM1** (when `deploy_target=both`). Rollback order: **VM2 → VM1** as well (both use the reverse rollout logic in their individual scripts to protect the internal-HTTP contract between VM1 and VM2).
5. Supports manual `workflow_dispatch` with inputs:
   - `action`: `deploy` or `rollback`
   - `version_tag`: e.g. `v1.3.3`
   - `target_vm`: `vm1`, `vm2`, or `both`

   For `deploy`, this assumes images for `version_tag` already exist in GHCR (no build step is run). For `rollback`, the script pulls the target version and recreates `yt-api` / `yt-service` with `--no-deps` so Traefik on VM1 is not restarted.

### Required GitHub secrets

SSH:
- `VM1_SSH_HOST`, `VM1_SSH_PORT`, `VM1_SSH_USER`, `VM1_SSH_PRIVATE_KEY`, `VM1_DEPLOY_PATH`
- `VM2_SSH_HOST`, `VM2_SSH_PORT`, `VM2_SSH_USER`, `VM2_SSH_PRIVATE_KEY`, `VM2_DEPLOY_PATH`

GHCR (required since v1.3.3 — the remote `docker login` step uses these):
- `GHCR_USERNAME`, `GHCR_PAT`

Optional repository variable:
- `DEPLOY_TIMEOUT_SECONDS` (default: `120`)

---

## 6. Checking Logs

Stream logs for all services:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Stream logs for a specific service:

```bash
docker compose -f docker-compose.prod.yml logs -f yt-api
docker compose -f docker-compose.prod.yml logs -f yt-service
docker compose -f docker-compose.prod.yml logs -f traefik
```

Show the last 100 lines without following:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 yt-api
```

---

## 7. Restarting Services

Restart a single service without pulling a new image:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod restart yt-api
docker compose -f docker-compose.prod.yml --env-file .env.prod restart yt-service
docker compose -f docker-compose.prod.yml --env-file .env.prod restart traefik
```

Restart all services:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod restart
```

Force-recreate a service (useful after config changes):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate yt-api
```

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `curl: Could not resolve host: api.DOMAIN` | DNS A record not yet propagated | Wait for propagation (`dig api.DOMAIN`). Do not proceed until DNS resolves. |
| Traefik returns `404 page not found` | Service label missing or Docker network mismatch | Verify `traefik.enable=true` labels on `yt-api` and that `traefik.docker.network=yt-hub_proxy` matches the `proxy` network name. |
| Let's Encrypt cert not issued; browser shows TLS error | DNS not resolved at cert issuance time, or `acme.json` missing | Ensure DNS is propagated, `traefik/acme.json` exists with `chmod 600`, and `LETSENCRYPT_EMAIL` is set. Check Traefik logs: `docker compose logs traefik`. |
| Rate limit hits immediately for all clients | Traefik IP not being forwarded; all requests appear to come from proxy IP | Ensure `SmartIpKeyExtractor` is in use (it is, as of this version). Verify Traefik forwards `X-Forwarded-For` by default — it does. No extra config needed unless a custom middleware strips the header. |
| `chmod: changing permissions of 'acme.json': Operation not permitted` | `acme.json` was created by Docker (root-owned) | Remove it and recreate: `sudo rm traefik/acme.json && touch traefik/acme.json && chmod 600 traefik/acme.json`. |
| `yt-api` can't reach `yt-service`; gRPC errors in logs | VM1->VM2 private route/firewall problem, or `yt-service` not healthy | Check VM2 `yt-service` health and VM1 `GRPC_TARGET`. Ensure VM2 gRPC port allows only VM1/private CIDR. |
| File download endpoint returns 404 in remote mode | File missing on VM2 downloads dir or wrong `INTERNAL_FILE_BASE_URL` | Verify VM2 `/internal/files/:filename` availability and shared `INTERNAL_API_KEY`. |
| Container keeps restarting (`Restarting` status) | Application crash on startup, usually bad config or missing env vars | Check logs immediately after start: `docker compose logs --tail=50 yt-api`. Common culprits: wrong `GRPC_TARGET`, invalid `ALLOWED_ORIGINS`. |
| Let's Encrypt ACME rate limit hit (`too many certificates` error) | More than 5 certificates issued for the same domain in a week | Switch to the staging CA temporarily (see section 8), wait one week, then switch back to production. |

---

## 9. Testing with Let's Encrypt Staging

Before your first production deploy, test certificate issuance with the Let's Encrypt staging environment to avoid consuming production rate limits.

**Step 1 — Edit `traefik/traefik.yml`**, add `caServer` under the ACME resolver:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      caServer: "https://acme-staging-v02.api.letsencrypt.org/directory"
      storage: /acme/acme.json
      httpChallenge:
        entryPoint: web
```

**Step 2 — Reset the ACME storage and restart Traefik:**

```bash
rm traefik/acme.json
touch traefik/acme.json
chmod 600 traefik/acme.json
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate traefik
```

**Step 3 — Verify** that Traefik logs show a successful staging certificate issuance. Your browser will show a certificate warning (staging certs are not trusted) — that is expected.

**Step 4 — Switch back to production** by removing the `caServer` line, resetting `acme.json`, and restarting Traefik:

```bash
rm traefik/acme.json
touch traefik/acme.json
chmod 600 traefik/acme.json
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate traefik
```

> **Important:** Remove the `caServer` line before going to production. Leaving it pointing at the staging CA will result in untrusted certificates for all users.
