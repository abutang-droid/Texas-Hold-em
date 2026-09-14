#!/usr/bin/env bash
# Pull the portrait Caribbean Stud table onto the Mac Expo client (no git).
#   bash scripts/mac-sync-stud-ui.sh
#   curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/stud-mobile-ui-9b0a/scripts/mac-sync-stud-ui.sh" | bash
set -euo pipefail

REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
REF="${STUD_UI_REF:-cursor/stud-mobile-ui-9b0a}"
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

echo "==> Sync stud UI from ${REF}"
download "apps/mobile/app/stud.tsx"
download "apps/mobile/src/components/ui/PlayingCard.tsx"
download "apps/mobile/assets/card-back.webp"
download "apps/mobile/src/locales/zh-CN.json"
download "apps/mobile/src/locales/en-US.json"
download "apps/mobile/src/theme/index.ts"
download "apps/mobile/app.json"

if ! grep -q 'STUD_UI_REV' "${REPO}/apps/mobile/app/stud.tsx"; then
  echo "ERROR: stud.tsx is still the old list layout. Do not start Expo." >&2
  exit 1
fi
if ! grep -q 'studFelt' "${REPO}/apps/mobile/src/theme/index.ts"; then
  echo "ERROR: theme missing studFelt — stud page will look broken." >&2
  exit 1
fi
if grep -q 'resolveAssetSource' "${REPO}/apps/mobile/src/components/ui/PlayingCard.tsx"; then
  echo "ERROR: PlayingCard.tsx still calls Image.resolveAssetSource (crashes Expo Web)." >&2
  exit 1
fi
if [ ! -s "${REPO}/apps/mobile/assets/card-back.webp" ] || [ "$(wc -c < "${REPO}/apps/mobile/assets/card-back.webp")" -lt 80000 ]; then
  echo "ERROR: card-back.webp missing or too small." >&2
  exit 1
fi
echo "OK stud.tsx is the portrait felt table (${REF})"

lsof -tiTCP:8081 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
rm -rf "${REPO}/apps/mobile/.expo" "${REPO}/apps/mobile/node_modules/.cache"

if [ -f "${REPO}/scripts/mac-mobile-dev.sh" ]; then
  echo "==> Starting Expo --clear"
  exec bash "${REPO}/scripts/mac-mobile-dev.sh"
fi

cd "${REPO}/apps/mobile"
exec npx expo start --clear --port 8081
