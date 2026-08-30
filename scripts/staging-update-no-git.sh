#!/usr/bin/env bash
# Update Staging without git (zip deploy). Preserves .env and PM2 config.
# Usage:
#   bash scripts/staging-update-no-git.sh
#   bash scripts/staging-update-no-git.sh cursor/poker-rules-6max-9b0a
#   ZIP_URL=https://... bash scripts/staging-update-no-git.sh <branch>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="abutang-droid/Texas-Hold-em"
BRANCH="${1:-main}"
EXPECTED_ROOM_VERSION="${EXPECTED_ROOM_VERSION:-0.4.8}"

zip_candidates=()
if [ -n "${ZIP_URL:-}" ]; then
  zip_candidates+=("${ZIP_URL}")
fi
zip_candidates+=(
  "https://ghfast.top/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip"
  "https://gh-proxy.com/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip"
  "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip"
)

TMP="/tmp/th-update-$$"
ZIP="${TMP}.zip"
BACKUP_ENV="/tmp/th-env-backup-$$"

echo "==> Texas Hold'em staging update (no-git)"
echo "    Branch: ${BRANCH}"
echo "    Target: ${ROOT}"
echo "    Expect Room: ${EXPECTED_ROOM_VERSION}"

if [ -f .env ]; then
  cp .env "$BACKUP_ENV"
  echo "==> Backed up .env"
fi

mkdir -p "$TMP"
downloaded=0
for candidate in "${zip_candidates[@]}"; do
  echo "==> Downloading ${candidate}"
  if curl -fsSL --retry 2 --retry-delay 2 --connect-timeout 20 -o "$ZIP" "$candidate"; then
    downloaded=1
    ZIP_URL="$candidate"
    break
  fi
  echo "    failed, trying next mirror..." >&2
done
if [ "$downloaded" -ne 1 ]; then
  echo "ERROR: all zip mirrors failed for branch ${BRANCH}" >&2
  exit 1
fi

echo "==> Extracting"
unzip -q -o "$ZIP" -d "$TMP"
SRC="${TMP}/${REPO//\//-}-${BRANCH}"
if [ ! -d "$SRC" ]; then
  # GitHub zip folder: slashes in branch become dashes
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
  if [ ! -f .env ] || [ -w .env ]; then
    cp "$BACKUP_ENV" .env
    echo "==> Restored .env"
  else
    echo "==> Kept existing .env (not writable — rsync did not replace it)"
    echo "    To fix for future deploys: sudo chown $(whoami):$(whoami) .env"
  fi
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
if ! (pnpm migrate || bash scripts/migrate.sh); then
  echo "WARN: migrate failed — continuing PM2 restart (DB may already be up to date)" >&2
fi

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
ROOM_HEALTH="$(curl -sf "http://127.0.0.1:${ROOM_P}/health" || true)"
echo "${ROOM_HEALTH:-Room health FAIL}"

if ! echo "${ROOM_HEALTH}" | grep -q "\"version\":\"${EXPECTED_ROOM_VERSION}\""; then
  echo "WARN: room version not ${EXPECTED_ROOM_VERSION} — run: bash scripts/staging-redeploy-room.sh" >&2
fi

echo "==> Register probe:"
curl -sf -X POST "http://127.0.0.1:${API_P}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"probe-$(date +%s)@example.com\",\"password\":\"testpass8\"}" \
  | head -c 150 && echo ""

echo ""
echo "Done. API 0.5.0 · Room ${EXPECTED_ROOM_VERSION} expected in health output above."
