#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deployCommon.sh
source "${SCRIPT_DIR}/lib/deployCommon.sh"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.vm1.yml}"
ENV_FILE="${ENV_FILE:-.env.prod.vm1}"
VERSION="${VERSION:-latest}"

if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found."
  exit 1
fi

if [ -d "./traefik/traefik.yml" ]; then
  error "./traefik/traefik.yml is a directory (Docker bind-mount quirk). Remove it and restore traefik.yml as a file, or re-run CD after syncing traefik/traefik.yml from the repo."
  exit 1
fi
if [ ! -f "./traefik/traefik.yml" ]; then
  error "./traefik/traefik.yml missing under deploy directory. CD should sync it from the repo for VM1."
  exit 1
fi

if [ "${SKIP_GRPC_TUNNEL_CHECK:-0}" != "1" ]; then
  if command -v nc >/dev/null 2>&1; then
    if ! nc -z -w 3 127.0.0.1 15051 2>/dev/null; then
      error "127.0.0.1:15051 is not reachable (gRPC tunnel to VM2 expected). Start the tunnel or set SKIP_GRPC_TUNNEL_CHECK=1 to deploy anyway."
      exit 1
    fi
  else
    log "nc not installed; skipping gRPC tunnel probe (install netcat-openbsd for preflight checks)"
  fi
fi

log "Deploying VM1 with VERSION=${VERSION}"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

TIMEOUT="${DEPLOY_TIMEOUT_SECONDS:-120}"
INTERVAL=3
ELAPSED=0
CONTAINER=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q yt-api)

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    ok "VM1 yt-api is healthy"
    VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    exit 0
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

error "VM1 yt-api did not become healthy within ${TIMEOUT}s (status: ${STATUS})"
exit 1
