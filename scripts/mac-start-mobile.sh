#!/usr/bin/env bash
# Mac one-shot: mirror sync + install + build shared + start Expo.
#
#   cd ~/Texas-Hold-em && bash scripts/mac-start-mobile.sh
#
# Without git pull (recommended on Mac mini):
#   cd ~/Texas-Hold-em
#   bash /tmp/mac-start.sh     # after downloading this file
set -euo pipefail

trap 'echo "ERROR: mac-start-mobile 失败（第 ${LINENO} 行）。请把上面完整输出发回来。" >&2' ERR

MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
MAC_GIT_REF="${MAC_GIT_REF:-main}"
MAC_REPO="${MAC_REPO:-abutang-droid/Texas-Hold-em}"

# Bootstrap mac-common.sh: /tmp copies must come from a live mirror, with
# local repo fallback if every CDN returns 404 (cache lag).
_load_mac_common() {
  local script_dir dest url ref fallback=""
  script_dir="$(cd "$(dirname "${MAC_SCRIPT_SELF}")" && pwd)"
  dest="/tmp/mac-common-$$.sh"

  if [ "${script_dir}" != "/tmp" ]; then
    if [ -f "${script_dir}/lib/mac-common.sh" ]; then
      printf '%s\n' "${script_dir}/lib/mac-common.sh"
      return 0
    fi
    if [ -f "${PWD}/scripts/lib/mac-common.sh" ]; then
      printf '%s\n' "${PWD}/scripts/lib/mac-common.sh"
      return 0
    fi
  fi

  echo "==> Loading latest mac-common from mirror" >&2
  for ref in "${MAC_GIT_REF}" main cursor/mac-expo-start-harden-9b0a; do
    for url in \
      "https://ghfast.top/https://raw.githubusercontent.com/${MAC_REPO}/${ref}/scripts/lib/mac-common.sh" \
      "https://gh-proxy.com/https://raw.githubusercontent.com/${MAC_REPO}/${ref}/scripts/lib/mac-common.sh" \
      "https://cdn.jsdelivr.net/gh/${MAC_REPO}@${ref}/scripts/lib/mac-common.sh" \
      "https://raw.gitmirror.com/${MAC_REPO}/${ref}/scripts/lib/mac-common.sh"
    do
      echo "    try ${url}" >&2
      if curl -fsSL --connect-timeout 8 --max-time 30 --retry 2 --retry-delay 2 "${url}" -o "${dest}"; then
        if grep -q 'start_expo_dev_server' "${dest}" 2>/dev/null; then
          if grep -q 'mac_urlencode_path' "${dest}" 2>/dev/null; then
            printf '%s\n' "${dest}"
            return 0
          fi
          cp "${dest}" "${dest}.fallback"
          fallback="${dest}.fallback"
        fi
      fi
      rm -f "${dest}"
    done
  done

  if [ -n "${fallback}" ]; then
    echo "==> 未拉到 r4 mac-common，使用较旧可用版本" >&2
    printf '%s\n' "${fallback}"
    return 0
  fi
  if [ -f "${PWD}/scripts/lib/mac-common.sh" ]; then
    echo "==> 镜像下载失败，改用本地 scripts/lib/mac-common.sh" >&2
    printf '%s\n' "${PWD}/scripts/lib/mac-common.sh"
    return 0
  fi
  echo "ERROR: 无法加载 mac-common.sh（镜像 404/超时，本地也没有）。请 30 秒后重试。" >&2
  return 1
}

# shellcheck source=lib/mac-common.sh
source "$(_load_mac_common)"

if declare -F print_mac_start_banner >/dev/null; then
  print_mac_start_banner
fi
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
