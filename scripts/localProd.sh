#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Local Docker testing — builds and runs the full stack without Traefik
# Uses docker-compose.yml directly, exposing yt-api on localhost:3000.
#
# Usage:
#   bash scripts/localProd.sh up      — build images, start stack, verify health
#   bash scripts/localProd.sh down    — stop stack and clean up
#   bash scripts/localProd.sh test    — run smoke tests against running stack
# =============================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()   { echo -e "${YELLOW}[local-prod] $*${RESET}"; }
ok()    { echo -e "${GREEN}[local-prod] $*${RESET}"; }
error() { echo -e "${RED}[local-prod] $*${RESET}" >&2; }
info()  { echo -e "${CYAN}[local-prod] $*${RESET}"; }

API_URL="http://localhost:3000"

ensure_env() {
  if [ ! -f .env ]; then
    log "Creating .env from .env.example..."
    cp .env.example .env
    # Override DOWNLOAD_DIR — .env.example has the container path,
    # but docker-compose.yml uses DOWNLOAD_DIR as the host-side bind mount source.
    sed -i '' 's|^DOWNLOAD_DIR=.*|DOWNLOAD_DIR=./downloads|' .env 2>/dev/null || \
    sed -i  's|^DOWNLOAD_DIR=.*|DOWNLOAD_DIR=./downloads|' .env
    ok "Created .env"
  fi
  mkdir -p downloads
}

start_stack() {
  ensure_env

  log "Building and starting stack..."
  docker compose up -d --build --remove-orphans

  log "Waiting for yt-api to become healthy (timeout: 90s)..."
  TIMEOUT=90
  INTERVAL=3
  ELAPSED=0
  CONTAINER=$(docker compose ps -q yt-api)

  while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
      break
    fi
    printf "."
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
  done
  echo ""

  if [ "$STATUS" != "healthy" ]; then
    error "yt-api did not become healthy within ${TIMEOUT}s"
    docker compose logs yt-api --tail=20
    exit 1
  fi

  ok "Stack is running"
  echo ""
  docker compose ps
  echo ""
  info "Endpoints:"
  info "  API:    ${API_URL}/health"
  info "  gRPC:   localhost:50051"
  echo ""
  info "Run smoke tests:   bash scripts/localProd.sh test"
  info "Stop everything:   bash scripts/localProd.sh down"
}

run_tests() {
  echo ""
  PASS=0
  FAIL=0

  run_test() {
    local name="$1"
    local result="$2"
    if [ "$result" = "ok" ]; then
      ok "  PASS: $name"
      PASS=$((PASS + 1))
    else
      error "  FAIL: $name"
      FAIL=$((FAIL + 1))
    fi
  }

  info "Running smoke tests against ${API_URL}"
  echo ""

  # 1. Health check
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
  [ "$HTTP_CODE" = "200" ] && run_test "Health check (GET /health → 200)" "ok" || run_test "Health check (GET /health → 200, got $HTTP_CODE)" "fail"

  # 2. Health response body
  BODY=$(curl -s "${API_URL}/health" 2>/dev/null || echo "")
  echo "$BODY" | grep -q '"ok"' && run_test "Health body contains \"ok\"" "ok" || run_test "Health body contains \"ok\"" "fail"

  # 3. Security headers
  HEADERS=$(curl -sI "${API_URL}/health" 2>/dev/null || echo "")
  echo "$HEADERS" | grep -qi "x-frame-options.*DENY" && run_test "X-Frame-Options: DENY" "ok" || run_test "X-Frame-Options: DENY" "fail"
  echo "$HEADERS" | grep -qi "x-content-type-options.*nosniff" && run_test "X-Content-Type-Options: nosniff" "ok" || run_test "X-Content-Type-Options: nosniff" "fail"
  echo "$HEADERS" | grep -qi "content-security-policy" && run_test "Content-Security-Policy present" "ok" || run_test "Content-Security-Policy present" "fail"

  # 4. CORS allowed origin
  CORS_OK=$(curl -sI -H "Origin: http://localhost:5173" "${API_URL}/health" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
  [ -n "$CORS_OK" ] && run_test "CORS allows localhost:5173" "ok" || run_test "CORS allows localhost:5173" "fail"

  # 5. CORS blocked origin
  CORS_BAD=$(curl -sI -H "Origin: http://evil.com" "${API_URL}/health" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
  [ -z "$CORS_BAD" ] && run_test "CORS blocks evil.com" "ok" || run_test "CORS blocks evil.com" "fail"

  # 6. Downloads endpoint rejects path traversal
  TRAVERSAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/downloads/..%2Fetc%2Fpasswd" 2>/dev/null || echo "000")
  [ "$TRAVERSAL_CODE" = "400" ] && run_test "Path traversal rejected (400)" "ok" || run_test "Path traversal rejected (got $TRAVERSAL_CODE)" "fail"

  # 7. Downloads endpoint returns 404 for non-existent file
  NOT_FOUND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/downloads/nonexistent.mp3" 2>/dev/null || echo "000")
  [ "$NOT_FOUND_CODE" = "404" ] && run_test "Non-existent file returns 404" "ok" || run_test "Non-existent file returns 404 (got $NOT_FOUND_CODE)" "fail"

  echo ""
  info "Results: $PASS passed, $FAIL failed"

  if [ "$FAIL" -gt 0 ]; then
    exit 1
  fi
}

stop_stack() {
  log "Stopping stack..."
  docker compose down -v 2>/dev/null || true
  ok "Stack stopped"
}

# --- Main ---

case "${1:-help}" in
  up)
    start_stack
    ;;
  down)
    stop_stack
    ;;
  test)
    run_tests
    ;;
  *)
    echo "Usage: bash scripts/localProd.sh <up|down|test>"
    echo ""
    echo "  up    — build images, start full stack on localhost"
    echo "  down  — stop stack and clean up"
    echo "  test  — run smoke tests against running stack"
    exit 1
    ;;
esac
