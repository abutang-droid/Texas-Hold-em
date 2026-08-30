#!/usr/bin/env bash
# Pull the call-loop client fix onto the Mac (no git required), then start Expo.
# Usage: bash scripts/mac-fix-call-loop.sh
#    or: curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/poker-rules-6max-9b0a/scripts/mac-fix-call-loop.sh" | bash
set -euo pipefail

REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
BRANCH="${MAC_GIT_REF:-cursor/poker-rules-6max-9b0a}"
SLUG="abutang-droid/Texas-Hold-em"

download() {
  local rel="$1"
  local dest="${REPO}/${rel}"
  mkdir -p "$(dirname "$dest")"
  local urls=(
    "https://ghfast.top/https://raw.githubusercontent.com/${SLUG}/${BRANCH}/${rel}"
    "https://cdn.jsdelivr.net/gh/${SLUG}@${BRANCH}/${rel}"
    "https://raw.gitmirror.com/${SLUG}/${BRANCH}/${rel}"
    "https://raw.githubusercontent.com/${SLUG}/${BRANCH}/${rel}"
  )
  local url
  for url in "${urls[@]}"; do
    echo "==> ${rel}"
    if curl -fsSL --globoff --retry 2 --connect-timeout 20 -o "${dest}.tmp" "$url"; then
      mv "${dest}.tmp" "$dest"
      return 0
    fi
    rm -f "${dest}.tmp"
  done
  echo "ERROR: could not download ${rel}" >&2
  return 1
}

if [ ! -d "${REPO}/apps/mobile" ]; then
  echo "ERROR: ${REPO} is not the Texas-Hold-em project" >&2
  exit 1
fi

echo "==> Syncing table client files from ${BRANCH}"
download "apps/mobile/app/table.tsx"
download "apps/mobile/src/components/ActionPanel.tsx"
download "apps/mobile/src/components/ChipFlyLayer.tsx"
download "apps/mobile/src/components/CommunityCardsRow.tsx"
download "apps/mobile/src/components/Table9Max.tsx"
download "apps/mobile/src/components/TurnTimer.tsx"
download "apps/mobile/src/components/ui/PlayingCard.tsx"

echo ""
echo "Client files updated."
echo "Staging Room must be 0.4.9 (5 bots + deal animation). On this Mac (same WiFi):"
echo "  bash ${REPO}/scripts/staging-remote-deploy.sh ${BRANCH}"
echo "Or on uoto@tex:"
echo "  ZIP_URL=https://ghfast.top/https://github.com/${SLUG}/archive/refs/heads/${BRANCH}.zip \\"
echo "    bash ${REPO}/scripts/staging-update-no-git.sh ${BRANCH}"
echo ""

if [ -f "${REPO}/scripts/mac-mobile-dev.sh" ]; then
  echo "==> Starting Expo"
  exec bash "${REPO}/scripts/mac-mobile-dev.sh"
fi
