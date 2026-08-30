#!/usr/bin/env bash
# Download only changed mobile source files via mirror (no full zip — saves disk).
# Safe to curl to /tmp: resolves repo from $PWD or ~/Texas-Hold-em (not script path).
#
#   cd ~/Texas-Hold-em && bash scripts/mac-update-mobile-files-mirror.sh
#   cd ~/Texas-Hold-em && bash /tmp/mac-files.sh
set -euo pipefail

resolve_repo_root() {
  if [ -n "${TH_REPO_ROOT:-}" ] && [ -f "${TH_REPO_ROOT}/apps/mobile/app/index.tsx" ]; then
    (cd "${TH_REPO_ROOT}" && pwd)
    return 0
  fi
  if [ -f "${PWD}/apps/mobile/app/index.tsx" ]; then
    (cd "${PWD}" && pwd)
    return 0
  fi
  local script_dir
  script_dir="$(cd "$(dirname "${1:-$0}")" && pwd)"
  if [ -f "${script_dir}/../apps/mobile/app/index.tsx" ]; then
    (cd "${script_dir}/.." && pwd)
    return 0
  fi
  if [ -f "${HOME}/Texas-Hold-em/apps/mobile/app/index.tsx" ]; then
    (cd "${HOME}/Texas-Hold-em" && pwd)
    return 0
  fi
  echo "ERROR: cannot find repo root. Run: cd ~/Texas-Hold-em && bash $0" >&2
  return 1
}

ROOT="$(resolve_repo_root "$0")"
cd "$ROOT"

BASE="${MIRROR_BASE:-https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main}"

FILES=(
  apps/mobile/metro.config.js
  apps/mobile/app/_layout.tsx
  apps/mobile/app/index.tsx
  apps/mobile/app/onboarding.tsx
  apps/mobile/app/private.tsx
  apps/mobile/app/auth/_layout.tsx
  apps/mobile/app/auth/login.tsx
  apps/mobile/app/auth/register.tsx
  apps/mobile/src/api/client.ts
  apps/mobile/src/storage/onboarding.ts
  apps/mobile/src/auth/routes.ts
  apps/mobile/src/components/Table9Max.tsx
  apps/mobile/src/components/ChipFlyLayer.tsx
  apps/mobile/src/components/ui/GameModal.tsx
  apps/mobile/src/locales/en-US.json
  apps/mobile/src/locales/zh-CN.json
  packages/shared/src/index.ts
  packages/shared/src/table-config.ts
)

echo "==> Mobile file sync via mirror (no zip)"
echo "    Root: ${ROOT}"
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

if command -v pnpm >/dev/null 2>&1; then
  echo "==> Building @texas-holdem/shared (required by Metro)"
  pnpm --filter @texas-holdem/shared build
else
  echo "WARN: pnpm not found — run: pnpm --filter @texas-holdem/shared build" >&2
fi

echo ""
echo "==> OK (${#FILES[@]} files)."
echo "    Next:"
echo "      cd apps/mobile"
echo "      rm -rf .expo node_modules/.cache"
echo "      npx expo start --clear"
echo ""
echo "    If bundle still 500, check the Metro terminal for the red error line."
