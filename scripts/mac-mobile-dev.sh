#!/usr/bin/env bash
# Start Expo web dev server (Mac). Builds shared package first to avoid Metro 500.
# Safe to curl to /tmp — run from repo: cd ~/Texas-Hold-em && bash /tmp/mac-dev.sh
#
#   cd ~/Texas-Hold-em && bash scripts/mac-mobile-dev.sh
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

# shellcheck source=lib/ensure-mobile-env.sh
source "${ROOT}/scripts/lib/ensure-mobile-env.sh" 2>/dev/null || true
if declare -F ensure_mobile_env >/dev/null; then
  ensure_mobile_env "$ROOT"
elif [ ! -f apps/mobile/.env ]; then
  mkdir -p apps/mobile
  cat > apps/mobile/.env <<'EOF'
EXPO_PUBLIC_API_URL=http://192.168.31.53:3000
EXPO_PUBLIC_ROOM_URL=http://192.168.31.53:3001
EOF
  echo "Created apps/mobile/.env (default staging URLs)"
fi

echo "==> Root: ${ROOT}"
echo "==> Build workspace packages used by mobile"
pnpm --filter @texas-holdem/shared build

echo "==> Clear Metro cache"
rm -rf apps/mobile/.expo apps/mobile/node_modules/.cache

echo "==> Start Expo (web: http://localhost:8081)"
cd apps/mobile
exec npx expo start --clear
