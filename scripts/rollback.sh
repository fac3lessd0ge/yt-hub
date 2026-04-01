#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()   { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] $*${RESET}"; }
ok()    { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $*${RESET}"; }
error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*${RESET}" >&2; }

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

if [ -z "${1:-}" ]; then
  error "Usage: rollback.sh <version-tag>  (e.g. rollback.sh v0.3.0)"
  exit 1
fi

VERSION="$1"

if [ ! -f "$ENV_FILE" ]; then
  error ".env.prod not found."
  exit 1
fi

log "Rolling back to VERSION=${VERSION}"

# Pull target images (yt-api and yt-service only; Traefik is unaffected)
log "Pulling images for VERSION=${VERSION}..."
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull yt-api yt-service

# Recreate only yt-api and yt-service
log "Restarting yt-api and yt-service..."
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps yt-api yt-service

# Wait for yt-api to become healthy
log "Waiting for yt-api to become healthy (timeout: 60s)..."
TIMEOUT=60
INTERVAL=3
ELAPSED=0
CONTAINER=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q yt-api)

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ "$STATUS" != "healthy" ]; then
  error "yt-api did not become healthy after rollback to ${VERSION} (status: ${STATUS})"
  error "Manual intervention required. Check: docker compose -f ${COMPOSE_FILE} logs yt-api"
  exit 1
fi

ok "Rollback to VERSION=${VERSION} succeeded."
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
