#!/usr/bin/env bash
# Mac: sync mobile client from GitHub mirror (no git pull). Then build shared.
#
#   cd ~/Texas-Hold-em && bash scripts/mac-sync-mobile.sh
#   cd ~/Texas-Hold-em && bash /tmp/mac-sync.sh
set -euo pipefail

MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
MIRROR_BASE="${MIRROR_BASE:-https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main}"

_load_mac_common() {
  local script_dir tmp
  script_dir="$(cd "$(dirname "${MAC_SCRIPT_SELF}")" && pwd)"
  if [ -f "${script_dir}/lib/mac-common.sh" ]; then
    printf '%s\n' "${script_dir}/lib/mac-common.sh"
    return 0
  fi
  if [ -f "${PWD}/scripts/lib/mac-common.sh" ]; then
    printf '%s\n' "${PWD}/scripts/lib/mac-common.sh"
    return 0
  fi
  tmp="/tmp/mac-common-$$.sh"
  if curl -fsSL --retry 2 "${MIRROR_BASE}/scripts/lib/mac-common.sh" -o "${tmp}"; then
    printf '%s\n' "${tmp}"
    return 0
  fi
  echo "ERROR: cannot load mac-common.sh — check network" >&2
  return 1
}

# shellcheck source=lib/mac-common.sh
source "$(_load_mac_common)"

ROOT="$(require_repo_root "${MAC_SCRIPT_SELF}")"
cd "${ROOT}"

sync_mobile_from_mirror "${ROOT}"
ensure_mobile_env "${ROOT}"
build_shared_package
verify_mobile_index "${ROOT}"

echo ""
echo "==> Sync complete. Start:"
echo "    bash scripts/mac-mobile-dev.sh"
