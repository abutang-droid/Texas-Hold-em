#!/usr/bin/env bash
# Mac one-shot: mirror sync + install + build shared + start Expo.
#
#   cd ~/Texas-Hold-em && bash scripts/mac-start-mobile.sh
#
# Or without git pull:
#   cd ~/Texas-Hold-em
#   curl -fsSL https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/mac-start-mobile.sh -o /tmp/mac-start.sh
#   bash /tmp/mac-start.sh
set -euo pipefail

trap 'echo "ERROR: mac-start-mobile failed (line ${LINENO}). See messages above." >&2' ERR

MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
MIRROR_BASE="${MIRROR_BASE:-https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main}"

_load_mac_common() {
  local script_dir tmp base
  script_dir="$(cd "$(dirname "${MAC_SCRIPT_SELF}")" && pwd)"
  base="${MIRROR_BASE}"

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

sync_mobile_from_mirror "${ROOT}"
ensure_mobile_env "${ROOT}"
ensure_workspace_deps "${ROOT}"
build_shared_package
verify_mobile_index "${ROOT}"
clear_expo_cache "${ROOT}"

echo "==> Root: ${ROOT}"
echo "==> API:  $(grep EXPO_PUBLIC_API_URL apps/mobile/.env || true)"
echo "==> Room: $(grep EXPO_PUBLIC_ROOM_URL apps/mobile/.env || true)"

start_expo_dev_server "${ROOT}"
