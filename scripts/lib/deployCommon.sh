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

# Host-side DOWNLOAD_DIR from a dotenv file (used only for bind-mount source paths).
read_download_host_dir_from_env_file() {
  local env_file="$1"
  local line val
  line=$(grep -E '^[[:space:]]*DOWNLOAD_DIR=' "$env_file" 2>/dev/null | tail -n1 || true)
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi
  val="${line#*=}"
  val="${val%%#*}"
  val="${val//$'\r'/}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  val="${val//\"/}"
  val="${val//\'/}"
  echo "$val"
}

# Ensure the host downloads directory exists and is writable by yt-service (UID 1001 in the image).
ensure_host_downloads_dir_for_vm2() {
  local env_file="$1"
  local host_dir
  host_dir="$(read_download_host_dir_from_env_file "$env_file")"
  if [[ -z "$host_dir" ]]; then
    host_dir="./downloads"
  fi
  if [[ "$host_dir" != /* ]]; then
    host_dir="$(pwd)/${host_dir#./}"
  fi
  log "Ensuring downloads host directory exists: $host_dir"
  mkdir -p "$host_dir"
  chmod 775 "$host_dir" 2>/dev/null || chmod 755 "$host_dir"
  if chown 1001:1001 "$host_dir" 2>/dev/null; then
    ok "Downloads dir ownership set to 1001:1001 (appuser in container)"
  else
    log "chown 1001:1001 not permitted; widening permissions so the container can write"
    chmod 777 "$host_dir" 2>/dev/null || true
  fi
}
