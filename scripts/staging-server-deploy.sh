#!/usr/bin/env bash
# Run ON the staging server (192.168.31.53) from any directory.
#
#   bash scripts/staging-server-deploy.sh
#   bash scripts/staging-server-deploy.sh cursor/poker-rules-6max-9b0a
#
# One-liner (always pulls the matching update script from the same branch):
#   curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/poker-rules-6max-9b0a/scripts/staging-server-deploy.sh" \
#     | bash -s cursor/poker-rules-6max-9b0a
set -euo pipefail

REPO_SLUG="abutang-droid/Texas-Hold-em"
REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
BRANCH="${1:-main}"

download_raw() {
  local rel="$1"
  local dest="$2"
  local urls=(
    "https://ghfast.top/https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}/${rel}"
    "https://cdn.jsdelivr.net/gh/${REPO_SLUG}@${BRANCH}/${rel}"
    "https://raw.gitmirror.com/${REPO_SLUG}/${BRANCH}/${rel}"
    "https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}/${rel}"
  )
  mkdir -p "$(dirname "$dest")"
  local url
  for url in "${urls[@]}"; do
    echo "==> Fetch ${rel} via ${url}"
    if curl -fsSL --retry 2 --connect-timeout 20 -o "${dest}.tmp" "$url"; then
      mv "${dest}.tmp" "$dest"
      chmod +x "$dest"
      return 0
    fi
    rm -f "${dest}.tmp"
  done
  echo "ERROR: could not download ${rel} from branch ${BRANCH}" >&2
  return 1
}

mkdir -p "${REPO}/scripts"
echo "==> Refreshing staging-update-no-git.sh from ${BRANCH}"
download_raw "scripts/staging-update-no-git.sh" "${REPO}/scripts/staging-update-no-git.sh"

cd "${REPO}"
echo "==> Deploying branch ${BRANCH} in ${REPO}"
bash scripts/staging-update-no-git.sh "${BRANCH}"
