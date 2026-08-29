#!/usr/bin/env bash
# Deploy to Staging LXC from your Mac (same LAN as 192.168.31.53).
#
# Usage:
#   bash scripts/staging-remote-deploy.sh              # deploy main
#   bash scripts/staging-remote-deploy.sh main         # explicit branch
#   STAGING_IP=192.168.31.53 bash scripts/staging-remote-deploy.sh
#
# Requires: ssh access to uoto@STAGING_IP (see docs/MAC-MINI-操作指南.md)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING_IP="${STAGING_IP:-192.168.31.53}"
STAGING_USER="${STAGING_USER:-uoto}"
STAGING_REPO="${STAGING_REPO:-~/Texas-Hold-em}"
BRANCH="${1:-main}"

SSH_OPTS=(-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
if [ -n "${SSH_KEY:-}" ] && [ -f "${SSH_KEY}" ]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
fi

echo "==> Texas Hold'em remote deploy"
echo "    Target: ${STAGING_USER}@${STAGING_IP}"
echo "    Branch: ${BRANCH}"
echo "    Repo:   ${STAGING_REPO}"
echo ""

if ! ping -c 1 -W 2 "${STAGING_IP}" >/dev/null 2>&1; then
  echo "ERROR: cannot ping ${STAGING_IP}. Connect Mac to the same WiFi/LAN." >&2
  exit 1
fi

echo "==> Running staging-update-no-git.sh on server..."
ssh "${SSH_OPTS[@]}" "${STAGING_USER}@${STAGING_IP}" \
  "cd ${STAGING_REPO} && bash scripts/staging-update-no-git.sh '${BRANCH}'"

echo ""
echo "==> Verifying from Mac..."
API_URL="http://${STAGING_IP}:3000" ROOM_URL="http://${STAGING_IP}:3001" \
  bash "${ROOT}/scripts/mac-staging-check.sh"

echo ""
echo "✓ Deploy complete. Admin: http://${STAGING_IP}:5173"
