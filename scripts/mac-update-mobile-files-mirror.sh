#!/usr/bin/env bash
# Download only changed mobile source files via mirror (no full zip — saves disk).
# Use when git pull and mac-update-mobile-mirror.sh both fail (disk full / github blocked).
#
#   cd ~/Texas-Hold-em && bash scripts/mac-update-mobile-files-mirror.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${MIRROR_BASE:-https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main}"

FILES=(
  apps/mobile/app/_layout.tsx
  apps/mobile/app/index.tsx
  apps/mobile/app/onboarding.tsx
  apps/mobile/app/auth/_layout.tsx
  apps/mobile/app/auth/login.tsx
  apps/mobile/app/auth/register.tsx
  apps/mobile/src/api/client.ts
  apps/mobile/src/storage/onboarding.ts
  apps/mobile/src/auth/routes.ts
  apps/mobile/src/components/ui/GameModal.tsx
  apps/mobile/src/locales/en-US.json
  apps/mobile/src/locales/zh-CN.json
)

echo "==> Mobile file sync via mirror (no zip)"
echo "    Base: ${BASE}"

for rel in "${FILES[@]}"; do
  dest="${ROOT}/${rel}"
  mkdir -p "$(dirname "$dest")"
  echo "  -> ${rel}"
  if ! curl -fsSL --retry 2 "${BASE}/${rel}" -o "${dest}.tmp"; then
    echo "ERROR: failed to download ${rel}" >&2
    rm -f "${dest}.tmp"
    exit 1
  fi
  mv "${dest}.tmp" "${dest}"
done

if grep -q "router.replace('/auth/login')" apps/mobile/app/index.tsx 2>/dev/null; then
  echo "ERROR: index.tsx still old after download" >&2
  exit 1
fi

echo ""
echo "==> OK (${#FILES[@]} files). Verify:"
echo "    grep router.replace apps/mobile/app/index.tsx   # should be empty"
echo ""
echo "    cd apps/mobile && rm -rf .expo node_modules/.cache && npx expo start --clear"
