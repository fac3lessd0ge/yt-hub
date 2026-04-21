#!/usr/bin/env bash
# Shared logging for deploy-vm*.sh / rollback-vm*.sh — source from scripts/:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "${SCRIPT_DIR}/lib/deployCommon.sh"

[[ -n "${DEPLOY_COMMON_LOADED:-}" ]] && return 0
DEPLOY_COMMON_LOADED=1

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] $*${RESET}"; }
ok() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $*${RESET}"; }
error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*${RESET}" >&2; }
