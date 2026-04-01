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
VERSION="${VERSION:-latest}"

# Validate environment
if [ ! -f "$ENV_FILE" ]; then
  error ".env.prod not found. Copy .env.prod.example and fill in real values."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  error "docker is not installed or not in PATH."
  exit 1
fi

log "Deploying VERSION=${VERSION}"

# Pull latest images
log "Pulling images..."
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

# Bring up services
log "Starting services..."
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

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
  error "yt-api did not become healthy within ${TIMEOUT}s (status: ${STATUS})"
  error "Check logs: docker compose -f ${COMPOSE_FILE} logs yt-api"
  exit 1
fi

ok "Deployment succeeded. VERSION=${VERSION}"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
