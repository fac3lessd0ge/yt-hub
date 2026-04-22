#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deployCommon.sh
source "${SCRIPT_DIR}/lib/deployCommon.sh"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.vm2.yml}"
ENV_FILE="${ENV_FILE:-.env.prod.vm2}"
SERVICE="${SERVICE:-yt-service}"
VERSION="${VERSION:-latest}"

if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found."
  exit 1
fi

ensure_host_downloads_dir_for_vm2 "$ENV_FILE"

log "Deploying VM2 with VERSION=${VERSION}"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull "$SERVICE"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps "$SERVICE"

TIMEOUT="${DEPLOY_TIMEOUT_SECONDS:-90}"
INTERVAL=3
ELAPSED=0
CONTAINER=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q "$SERVICE")

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    ok "VM2 service is healthy"
    VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    exit 0
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

error "VM2 service did not become healthy within ${TIMEOUT}s (status: ${STATUS})"
exit 1
