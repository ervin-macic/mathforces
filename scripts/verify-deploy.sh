#!/usr/bin/env bash
# Usage:
#   API_URL=https://your-api.up.railway.app \
#   FRONTEND_URL=https://your-frontend.up.railway.app \
#   bash scripts/verify-deploy.sh
#
# Both variables are required.

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; FAILED=$((FAILED+1)); }
info() { echo -e "${YELLOW}→${NC} $1"; }

FAILED=0

if [[ -z "${API_URL:-}" || -z "${FRONTEND_URL:-}" ]]; then
  echo "Usage: API_URL=https://... FRONTEND_URL=https://... bash $0"
  exit 1
fi

API_URL="${API_URL%/}"       # strip trailing slash
FRONTEND_URL="${FRONTEND_URL%/}"

echo ""
echo "Verifying MathForces deployment"
echo "  API:      $API_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

# ── 1. Health check ────────────────────────────────────────────────────────────
info "Health check: GET $API_URL/health"
HEALTH_BODY=$(curl -sf "$API_URL/health" 2>&1) && {
  if echo "$HEALTH_BODY" | grep -q '"status":"ok"'; then
    pass "/health → $HEALTH_BODY"
  else
    fail "/health response missing status:ok → $HEALTH_BODY"
  fi
} || fail "/health request failed (curl exit $?)"

# ── 2. CORS preflight ──────────────────────────────────────────────────────────
info "CORS preflight: OPTIONS $API_URL/api/problems (Origin: $FRONTEND_URL)"
CORS_HEADERS=$(curl -sf -D - -o /dev/null \
  -X OPTIONS \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  "$API_URL/api/problems" 2>&1) && {
  if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin: $FRONTEND_URL"; then
    pass "CORS: Access-Control-Allow-Origin matches frontend origin"
  elif echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin:"; then
    ACAO=$(echo "$CORS_HEADERS" | grep -i "access-control-allow-origin:" | head -1)
    fail "CORS: got wrong origin — $ACAO (expected $FRONTEND_URL)"
  else
    fail "CORS: no Access-Control-Allow-Origin header in preflight response"
    echo "  Response headers:"
    echo "$CORS_HEADERS" | head -20 | sed 's/^/    /'
  fi
} || fail "CORS preflight request failed (curl exit $?)"

# ── 3. Problems endpoint ───────────────────────────────────────────────────────
info "Problems endpoint: GET $API_URL/api/problems?limit=5"
PROBLEMS=$(curl -sf \
  -H "Origin: $FRONTEND_URL" \
  "$API_URL/api/problems?limit=5" 2>&1) && {
  COUNT=$(echo "$PROBLEMS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('problems', d) if isinstance(d, dict) else d))" 2>/dev/null || echo "?")
  pass "/api/problems returned $COUNT problems (sample)"
} || fail "/api/problems request failed"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}All checks passed.${NC}"
else
  echo -e "${RED}$FAILED check(s) failed.${NC}"
  exit 1
fi
