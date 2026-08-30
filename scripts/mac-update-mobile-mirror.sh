#!/usr/bin/env bash
# Update mobile app on Mac when git pull to github.com fails (China network).
# Preserves apps/mobile/.env
#
#   cd ~/Texas-Hold-em && bash scripts/mac-update-mobile-mirror.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="abutang-droid/Texas-Hold-em"
BRANCH="${1:-main}"
ZIP_URL="${ZIP_URL:-https://ghfast.top/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip}"

TMP="/tmp/th-mac-mobile-$$"
ZIP="${TMP}.zip"
ENV_BACKUP=""

echo "==> Mobile update via mirror (no git)"
echo "    Root: ${ROOT}"
echo "    Branch: ${BRANCH}"

if [ -f apps/mobile/.env ]; then
  ENV_BACKUP="$(mktemp)"
  cp apps/mobile/.env "$ENV_BACKUP"
  echo "==> Backed up apps/mobile/.env"
fi

mkdir -p "$TMP"
echo "==> Downloading ${ZIP_URL}"
if ! curl -fsSL --retry 3 --retry-delay 2 -o "$ZIP" "$ZIP_URL"; then
  echo "Download failed. Try:" >&2
  echo "  ZIP_URL=https://mirror.ghproxy.com/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip bash $0" >&2
  exit 1
fi

echo "==> Extracting"
unzip -q -o "$ZIP" -d "$TMP"
SRC="$(find "$TMP" -maxdepth 1 -type d ! -path "$TMP" | head -1)"
if [ ! -f "$SRC/apps/mobile/app/_layout.tsx" ]; then
  echo "ERROR: invalid zip — missing apps/mobile" >&2
  exit 1
fi

echo "==> Syncing apps/mobile (keeping .env, node_modules)"
rsync -a --delete \
  --exclude node_modules \
  --exclude .env \
  "$SRC/apps/mobile/" "$ROOT/apps/mobile/"

if [ -n "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" apps/mobile/.env
  rm -f "$ENV_BACKUP"
  echo "==> Restored apps/mobile/.env"
fi

rm -rf "$TMP" "$ZIP"

if grep -q "router.replace('/auth/login')" apps/mobile/app/index.tsx 2>/dev/null; then
  echo "ERROR: index.tsx still has old auth redirect — zip may be stale" >&2
  exit 1
fi

if ! grep -q "LAYOUT_REV = '2026-08-30-nav2'" apps/mobile/app/_layout.tsx 2>/dev/null; then
  echo "WARN: _layout.tsx may be older than expected — check console for [mobile] layout rev" >&2
fi

echo ""
echo "==> OK. Next:"
echo "    cd apps/mobile"
echo "    rm -rf .expo node_modules/.cache"
echo "    npx expo start --clear"
echo ""
echo "    Browser console should show: [mobile] layout 2026-08-30-nav2"
echo "    Open: http://localhost:8081/auth/login"
