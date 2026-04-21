#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deployCommon.sh
source "${SCRIPT_DIR}/lib/deployCommon.sh"

if [ -z "${1:-}" ]; then
  error "Usage: rollback-vm2.sh <version-tag>"
  exit 1
fi

VERSION="$1"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.vm2.yml}"
ENV_FILE="${ENV_FILE:-.env.prod.vm2}"
SERVICE="${SERVICE:-yt-service}"

if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found."
  exit 1
fi

log "Rolling back VM2 to VERSION=${VERSION}"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull "$SERVICE"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps "$SERVICE"
ok "VM2 rollback applied"
