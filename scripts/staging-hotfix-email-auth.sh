#!/usr/bin/env bash
# Hotfix: deploy email-auth API on servers still on v0.4.0 (no git / stale PM2).
# Run on server: bash scripts/staging-hotfix-email-auth.sh
set -euo pipefail

ROOT="${1:-$HOME/Texas-Hold-em}"
cd "$ROOT"

API_P="${API_PORT:-3000}"
REPO="abutang-droid/Texas-Hold-em"
BRANCH="main"

echo "========== 1. Current API =========="
curl -sf "http://127.0.0.1:${API_P}/health" 2>/dev/null || echo "(health unreachable)"
echo ""

echo "========== 2. Source check =========="
if grep -q "auth/register" apps/api/src/main.ts 2>/dev/null; then
  echo "OK: src has auth/register"
else
  echo "MISSING: src has no auth/register — downloading main zip..."
  ENV_BACKUP="/tmp/th-env-$$"
  [ -f .env ] && cp .env "$ENV_BACKUP"
  TMP="/tmp/th-hotfix-$$"
  ZIP="/tmp/th-main-$$.zip"
  URL="https://ghfast.top/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip"
  curl -fsSL --retry 3 -o "$ZIP" "$URL" || \
    curl -fsSL --retry 3 -o "$ZIP" "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip"
  mkdir -p "$TMP" && unzip -qo "$ZIP" -d "$TMP"
  SRC="$(find "$TMP" -maxdepth 1 -type d ! -path "$TMP" | head -1)"
  rsync -a --delete "$SRC/" "$ROOT/" --exclude node_modules --exclude .env
  [ -f "$ENV_BACKUP" ] && cp "$ENV_BACKUP" .env
  rm -rf "$TMP" "$ZIP"
  echo "Synced from zip."
fi

echo "========== 3. Build =========="
command -v pnpm >/dev/null || { echo "pnpm not found"; exit 1; }
pnpm install
pnpm --filter @texas-holdem/db build
pnpm --filter @texas-holdem/api build

if grep -q "auth/register" apps/api/dist/main.js; then
  echo "OK: dist/main.js has auth/register"
else
  echo "FAIL: dist still missing auth/register after build"
  exit 1
fi

echo "========== 4. Migrate =========="
pnpm migrate 2>/dev/null || bash scripts/migrate.sh

echo "========== 5. PM2 hard restart =========="
pm2 delete th-api 2>/dev/null || true
set -a
# shellcheck disable=SC1091
[ -f .env ] && source .env
set +a
pm2 start infra/staging/ecosystem.config.cjs --only th-api --update-env
pm2 save

sleep 3

echo "========== 6. Verify =========="
curl -sf "http://127.0.0.1:${API_P}/health" && echo ""
echo ""
curl -sf -X POST "http://127.0.0.1:${API_P}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"hotfix-$(date +%s)@example.com\",\"password\":\"testpass8\",\"nickname\":\"Hotfix\"}" \
  | head -c 200 && echo ""
echo ""
echo "Expected: health version 0.5.0 + register returns token JSON"
