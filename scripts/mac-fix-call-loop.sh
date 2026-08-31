#!/usr/bin/env bash
# Pull the call-loop client fix onto the Mac (no git required), then start Expo.
# Usage: bash scripts/mac-fix-call-loop.sh
#    or: curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/poker-rules-6max-9b0a/scripts/mac-fix-call-loop.sh" | bash
set -euo pipefail

REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
BRANCH="${MAC_GIT_REF:-cursor/poker-rules-6max-9b0a}"
SLUG="abutang-droid/Texas-Hold-em"

# Pin table.tsx to a commit so ghfast/jsdelivr cannot serve the crashing snapshot.
TABLE_FIX_REF="${TABLE_FIX_REF:-cursor/poker-rules-6max-9b0a}"

download() {
  local rel="$1"
  local dest="${REPO}/${rel}"
  local ref="${2:-$BRANCH}"
  mkdir -p "$(dirname "$dest")"
  local stamp
  stamp="$(date +%s)"
  local urls=(
    "https://raw.githubusercontent.com/${SLUG}/${ref}/${rel}?t=${stamp}"
    "https://ghfast.top/https://raw.githubusercontent.com/${SLUG}/${ref}/${rel}"
    "https://cdn.jsdelivr.net/gh/${SLUG}@${ref}/${rel}"
    "https://raw.gitmirror.com/${SLUG}/${ref}/${rel}"
  )
  local url
  for url in "${urls[@]}"; do
    echo "==> ${rel}  (${ref})"
    if curl -fsSL --globoff --retry 2 --connect-timeout 20 -o "${dest}.tmp" "$url"; then
      mv "${dest}.tmp" "$dest"
      return 0
    fi
    rm -f "${dest}.tmp"
  done
  echo "ERROR: could not download ${rel}" >&2
  return 1
}

table_has_snapshot_fix() {
  local f="${REPO}/apps/mobile/app/table.tsx"
  grep -q 'applySnapshotMeFix' "$f" && grep -q 'sitDownWebConfirm' "$f"
}

if [ ! -d "${REPO}/apps/mobile" ]; then
  echo "ERROR: ${REPO} is not the Texas-Hold-em project" >&2
  exit 1
fi

echo "==> Syncing table client files from ${BRANCH}"
download "apps/mobile/app/table.tsx" "${TABLE_FIX_REF}"
if ! table_has_snapshot_fix; then
  echo "WARN: table.tsx missing applySnapshotMeFix — retrying GitHub raw" >&2
  download "apps/mobile/app/table.tsx" "${TABLE_FIX_REF}"
fi
if ! table_has_snapshot_fix; then
  echo "ERROR: apps/mobile/app/table.tsx is still the crashing build. Do not start Expo." >&2
  echo "       Check: grep applySnapshotMeFix ${REPO}/apps/mobile/app/table.tsx" >&2
  exit 1
fi
echo "OK table.tsx has applySnapshotMeFix"
download "apps/mobile/app/_layout.tsx" "${TABLE_FIX_REF}"
download "apps/mobile/app/index.tsx" "${TABLE_FIX_REF}"
download "apps/mobile/src/theme/index.ts"
download "packages/shared/src/design-tokens/colors.json"
download "packages/shared/src/avatars.ts"
download "apps/mobile/src/components/ActionPanel.tsx"
download "apps/mobile/src/components/ChipFlyLayer.tsx"
download "apps/mobile/src/components/CommunityCardsRow.tsx"
download "apps/mobile/src/components/Table9Max.tsx"
download "apps/mobile/src/components/table-layout.ts"
download "apps/mobile/src/components/DealerStation.tsx"
download "apps/mobile/src/components/DealFlyLayer.tsx"
download "apps/mobile/src/components/ShowdownOverlay.tsx"
download "apps/mobile/src/components/TurnTimer.tsx"
download "apps/mobile/src/components/HandStatusBar.tsx"
download "apps/mobile/src/components/PotDisplay.tsx"
download "apps/mobile/src/components/ui/PlayingCard.tsx"
download "apps/mobile/src/components/ui/Button.tsx"
download "apps/mobile/src/components/ui/Card.tsx"
download "apps/mobile/src/components/ui/GameModal.tsx"
download "apps/mobile/src/components/ui/Screen.tsx"
download "apps/mobile/app.json"
download "apps/mobile/src/locales/zh-CN.json"
download "apps/mobile/src/locales/en-US.json"
download "apps/mobile/src/utils/alert.ts"
download "apps/mobile/src/types/table.ts"
download "apps/mobile/src/utils/nickname.ts"

echo ""
echo "Mac mini 客户端已更新。服务端请在家庭服务器 uoto@192.168.31.53 上单独部署，不要在这台 Mac 上跑 staging-update。"
echo "服务器成功标志: curl -s http://127.0.0.1:3001/health  → version 0.5.2"
echo ""

if [ -f "${REPO}/scripts/mac-mobile-dev.sh" ]; then
  echo "==> Starting Expo"
  exec bash "${REPO}/scripts/mac-mobile-dev.sh"
fi
