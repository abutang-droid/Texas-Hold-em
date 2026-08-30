#!/usr/bin/env bash
# Update mobile via zip (apps/mobile + packages/shared only — skips docs/).
# Prefer: bash scripts/mac-sync-mobile.sh (file-by-file, more reliable).
#
#   cd ~/Texas-Hold-em && bash scripts/mac-update-mobile-mirror.sh
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
  curl -fsSL --retry 2 "${MIRROR_BASE}/scripts/lib/mac-common.sh" -o "${tmp}"
  printf '%s\n' "${tmp}"
}

# shellcheck source=lib/mac-common.sh
source "$(_load_mac_common)"

ROOT="$(require_repo_root "${MAC_SCRIPT_SELF}")"
cd "${ROOT}"

REPO="abutang-droid/Texas-Hold-em"
BRANCH="${1:-main}"
ZIP_URL="${ZIP_URL:-https://ghfast.top/https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip}"
TMP="/tmp/th-mac-mobile-$$"
ZIP="${TMP}.zip"
ENV_BACKUP=""

echo "==> Mobile zip update (mobile + shared only)"
echo "    Root: ${ROOT}"

if [ -f apps/mobile/.env ]; then
  ENV_BACKUP="$(mktemp)"
  cp apps/mobile/.env "${ENV_BACKUP}"
fi

mkdir -p "${TMP}"
echo "==> Downloading zip"
curl -fsSL --retry 3 -o "${ZIP}" "${ZIP_URL}"

FOLDER="$(unzip -Z1 "${ZIP}" | head -1 | cut -d/ -f1)"
echo "==> Extracting ${FOLDER}/apps/mobile and packages/shared only"
while IFS= read -r path; do
  [ -z "${path}" ] && continue
  unzip -q -o "${ZIP}" "${path}" -d "${TMP}"
done < <(unzip -Z1 "${ZIP}" | grep -E "^${FOLDER}/(apps/mobile|packages/shared)/")

echo "==> Rsync (keeping .env)"
rsync -a --delete --exclude node_modules --exclude .env "${TMP}/${FOLDER}/apps/mobile/" "${ROOT}/apps/mobile/"
rsync -a --delete "${TMP}/${FOLDER}/packages/shared/" "${ROOT}/packages/shared/"

if [ -n "${ENV_BACKUP}" ]; then
  cp "${ENV_BACKUP}" apps/mobile/.env
  rm -f "${ENV_BACKUP}"
fi
rm -rf "${TMP}" "${ZIP}"

ensure_mobile_env "${ROOT}"
build_shared_package
verify_mobile_index "${ROOT}"

echo ""
echo "==> OK. Run: bash scripts/mac-mobile-dev.sh"
