#!/usr/bin/env bash
# Replace only apps/mobile/app/table.tsx (fixes "me is not defined").
# Usage on Mac mini:
#   curl -fsSL --globoff \
#     "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/poker-rules-6max-9b0a/scripts/mac-fix-table-crash.sh" \
#     -o /tmp/mac-fix-table.sh
#   bash /tmp/mac-fix-table.sh
set -euo pipefail

REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
SLUG="abutang-droid/Texas-Hold-em"
REF="${TABLE_FIX_REF:-cursor/poker-rules-6max-9b0a}"
DEST="${REPO}/apps/mobile/app/table.tsx"
STAMP="$(date +%s)"

if [ ! -d "${REPO}/apps/mobile" ]; then
  echo "ERROR: ${REPO} is not the Texas-Hold-em project" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
urls=(
  "https://raw.githubusercontent.com/${SLUG}/${REF}/apps/mobile/app/table.tsx?t=${STAMP}"
  "https://ghfast.top/https://raw.githubusercontent.com/${SLUG}/${REF}/apps/mobile/app/table.tsx"
  "https://raw.gitmirror.com/${SLUG}/${REF}/apps/mobile/app/table.tsx"
)

ok=0
for url in "${urls[@]}"; do
  echo "==> ${url}"
  if curl -fsSL --globoff --retry 2 --connect-timeout 20 -o "${DEST}.tmp" "$url"; then
    mv "${DEST}.tmp" "$DEST"
    ok=1
    break
  fi
  rm -f "${DEST}.tmp"
done

if [ "$ok" -ne 1 ]; then
  echo "ERROR: could not download table.tsx" >&2
  exit 1
fi

if ! grep -q 'applySnapshotMeFix' "$DEST"; then
  echo "ERROR: downloaded table.tsx is stale (no applySnapshotMeFix)" >&2
  exit 1
fi

echo "OK ${DEST}"
echo "请在浏览器对 Expo 页面强制刷新（Cmd+Shift+R），或停掉 Expo 再开。"
