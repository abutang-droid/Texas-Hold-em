#!/usr/bin/env bash
# Pull the play-select home onto the Mac Expo client (no git).
#   bash scripts/mac-sync-play-select.sh
#   curl -fsSL --globoff -o /tmp/sync-play.sh "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/play-select-home-9b0a/scripts/mac-sync-play-select.sh"
#   bash /tmp/sync-play.sh
set -euo pipefail

REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
REF="${PLAY_SELECT_REF:-cursor/play-select-home-9b0a}"
SLUG="abutang-droid/Texas-Hold-em"

download() {
  local rel="$1"
  local dest="${REPO}/${rel}"
  mkdir -p "$(dirname "$dest")"
  local stamp urls url
  stamp="$(date +%s)"
  urls=(
    "https://raw.githubusercontent.com/${SLUG}/${REF}/${rel}?t=${stamp}"
    "https://ghfast.top/https://raw.githubusercontent.com/${SLUG}/${REF}/${rel}"
    "https://cdn.jsdelivr.net/gh/${SLUG}@${REF}/${rel}"
    "https://raw.gitmirror.com/${SLUG}/${REF}/${rel}"
  )
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

echo "==> Sync play-select home from ${REF}"
download "apps/mobile/app/index.tsx"
download "apps/mobile/app/holdem.tsx"
download "apps/mobile/app/tables.tsx"
download "apps/mobile/app/onboarding.tsx"
download "apps/mobile/src/locales/zh-CN.json"
download "apps/mobile/src/locales/en-US.json"
download "docs/DESIGN-SPEC.md"

if ! grep -q 'PLAY_SELECT_REV' "${REPO}/apps/mobile/app/index.tsx"; then
  echo "ERROR: index.tsx is still the old mixed lobby. Do not start Expo." >&2
  exit 1
fi
if [ ! -s "${REPO}/apps/mobile/app/holdem.tsx" ]; then
  echo "ERROR: holdem.tsx missing." >&2
  exit 1
fi
echo "OK home is play-select (${REF})"

lsof -tiTCP:8081 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
rm -rf "${REPO}/apps/mobile/.expo" "${REPO}/apps/mobile/node_modules/.cache"

if [ -f "${REPO}/scripts/mac-mobile-dev.sh" ]; then
  echo "==> Starting Expo --clear"
  exec bash "${REPO}/scripts/mac-mobile-dev.sh"
fi

cd "${REPO}/apps/mobile"
exec npx expo start --clear --port 8081
