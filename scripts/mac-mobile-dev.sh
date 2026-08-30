#!/usr/bin/env bash
# Start Expo web dev server on Mac (install deps, build shared, clears cache).
#
#   cd ~/Texas-Hold-em && bash scripts/mac-mobile-dev.sh
#   cd ~/Texas-Hold-em && bash /tmp/mac-dev.sh
set -euo pipefail

trap 'echo "ERROR: mac-mobile-dev failed (line ${LINENO}). See messages above." >&2' ERR

MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
MIRROR_BASE="${MIRROR_BASE:-https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main}"

_load_mac_common() {
  local script_dir tmp base
  script_dir="$(cd "$(dirname "${MAC_SCRIPT_SELF}")" && pwd)"
  base="${MIRROR_BASE}"

  # curl → /tmp scripts must load latest lib (repo copy may be stale after mirror-only updates)
  if [ "${script_dir}" = "/tmp" ]; then
    tmp="/tmp/mac-common-$$.sh"
    echo "==> Loading latest mac-common from mirror"
    curl -fsSL --retry 2 "${base}/scripts/lib/mac-common.sh" -o "${tmp}"
    printf '%s\n' "${tmp}"
    return 0
  fi

  if [ -f "${script_dir}/lib/mac-common.sh" ]; then
    printf '%s\n' "${script_dir}/lib/mac-common.sh"
    return 0
  fi
  if [ -f "${PWD}/scripts/lib/mac-common.sh" ]; then
    printf '%s\n' "${PWD}/scripts/lib/mac-common.sh"
    return 0
  fi
  tmp="/tmp/mac-common-$$.sh"
  curl -fsSL --retry 2 "${base}/scripts/lib/mac-common.sh" -o "${tmp}"
  printf '%s\n' "${tmp}"
}

# shellcheck source=lib/mac-common.sh
source "$(_load_mac_common)"

ROOT="$(require_repo_root "${MAC_SCRIPT_SELF}")"
cd "${ROOT}"

ensure_mobile_env "${ROOT}"
ensure_workspace_deps "${ROOT}"
build_shared_package
clear_expo_cache "${ROOT}"

echo "==> Root: ${ROOT}"
echo "==> API:  $(grep EXPO_PUBLIC_API_URL apps/mobile/.env || true)"
echo "==> Room: $(grep EXPO_PUBLIC_ROOM_URL apps/mobile/.env || true)"

start_expo_dev_server "${ROOT}"
