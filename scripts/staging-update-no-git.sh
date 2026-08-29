#!/usr/bin/env bash
# Update Staging without git (zip deploy). Preserves .env and PM2 config.
# Usage: bash scripts/staging-update-no-git.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="abutang-droid/Texas-Hold-em"
BRANCH="${1:-main}"
ZIP_URL="${ZIP_URL:-https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip}"
# China mirror fallback: ZIP_URL=https://ghfast.top/https://github.com/.../archive/refs/heads/main.zip

TMP="/tmp/th-update-$$"
ZIP="${TMP}.zip"
BACKUP_ENV="/tmp/th-env-backup-$$"

echo "==> Texas Hold'em staging update (no-git)"
echo "    Branch: ${BRANCH}"
echo "    Target: ${ROOT}"

if [ -f .env ]; then
  cp .env "$BACKUP_ENV"
  echo "==> Backed up .env"
fi

mkdir -p "$TMP"
echo "==> Downloading ${ZIP_URL}"
if ! curl -fsSL --retry 3 --retry-delay 2 -o "$ZIP" "$ZIP_URL"; then
  echo "Download failed. Try mirror:" >&2
  echo "  ZIP_URL=https://ghfast.top/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip bash $0" >&2
  exit 1
fi

echo "==> Extracting"
unzip -q -o "$ZIP" -d "$TMP"
SRC="${TMP}/${REPO//\//-}-${BRANCH}"
if [ ! -d "$SRC" ]; then
  # GitHub zip folder name: Texas-Hold-em-main
  SRC="$(find "$TMP" -maxdepth 1 -type d ! -path "$TMP" | head -1)"
fi
if [ ! -f "$SRC/apps/api/src/main.ts" ]; then
  echo "ERROR: invalid zip layout" >&2
  exit 1
fi

echo "==> Syncing files (keeping .env, node_modules)"
rsync -a --delete \
  --exclude node_modules \
  --exclude '.env' \
  --exclude 'apps/*/dist' \
  --exclude 'packages/*/dist' \
  "$SRC/" "$ROOT/"

if [ -f "$BACKUP_ENV" ]; then
  cp "$BACKUP_ENV" .env
  echo "==> Restored .env"
fi

rm -rf "$TMP" "$ZIP"

if ! grep -q "auth/register" apps/api/src/main.ts; then
  echo "ERROR: source still missing auth/register — wrong branch?" >&2
  exit 1
fi

echo "==> Clean stale dist (avoid old poker-engine exports after rsync)"
rm -rf apps/*/dist packages/*/dist

echo "==> pnpm install"
pnpm install

echo "==> pnpm build"
pnpm build

echo "==> migrate"
pnpm migrate || bash scripts/migrate.sh

if ! grep -q "auth/register" apps/api/dist/main.js; then
  echo "ERROR: build missing auth/register in dist" >&2
  exit 1
fi

echo "==> PM2 restart"
pm2 startOrRestart infra/staging/ecosystem.config.cjs --update-env
pm2 save

sleep 2
API_P="${API_PORT:-3000}"
ROOM_P="${ROOM_PORT:-3001}"
echo ""
echo "==> Health:"
curl -sf "http://127.0.0.1:${API_P}/health" && echo "" || echo "API health FAIL"
curl -sf "http://127.0.0.1:${ROOM_P}/health" && echo "" || echo "Room health FAIL"

if ! curl -sf "http://127.0.0.1:${ROOM_P}/health" | grep -q '"version":"0.4'; then
  echo "WARN: room version still old — check: pm2 logs th-room --lines 30" >&2
fi

echo "==> Register probe:"
curl -sf -X POST "http://127.0.0.1:${API_P}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"probe-$(date +%s)@example.com\",\"password\":\"testpass8\"}" \
  | head -c 150 && echo ""

echo ""
echo "Done. health version should be 0.5.0 with emailAuth:true"
