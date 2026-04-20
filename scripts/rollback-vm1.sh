#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/deployCommon.sh
source "${SCRIPT_DIR}/lib/deployCommon.sh"

if [ -z "${1:-}" ]; then
  error "Usage: rollback-vm1.sh <version-tag>"
  exit 1
fi

VERSION="$1"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.vm1.yml}"
ENV_FILE="${ENV_FILE:-.env.prod.vm1}"

if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found."
  exit 1
fi

log "Rolling back VM1 to VERSION=${VERSION}"
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull yt-api
VERSION="${VERSION}" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps yt-api
ok "VM1 rollback applied"
