#!/usr/bin/env bash
# Run ON the staging server (192.168.31.53) from any directory.
#
#   bash scripts/staging-server-deploy.sh
#   bash scripts/staging-server-deploy.sh main
#
# Or one-liner (no local repo needed):
#   curl -fsSL "https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main/scripts/staging-server-deploy.sh" | bash -s main
set -euo pipefail

REPO="${TH_REPO_ROOT:-$HOME/Texas-Hold-em}"
BRANCH="${1:-main}"
GITHUB_RAW="${GITHUB_RAW:-https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main}"

mkdir -p "${REPO}/scripts"

if [ ! -f "${REPO}/scripts/staging-update-no-git.sh" ]; then
  echo "==> First deploy: downloading update script into ${REPO}"
  curl -fsSL --retry 3 "${GITHUB_RAW}/scripts/staging-update-no-git.sh" \
    -o "${REPO}/scripts/staging-update-no-git.sh"
  chmod +x "${REPO}/scripts/staging-update-no-git.sh"
fi

cd "${REPO}"
echo "==> Deploying branch ${BRANCH} in ${REPO}"
bash scripts/staging-update-no-git.sh "${BRANCH}"
