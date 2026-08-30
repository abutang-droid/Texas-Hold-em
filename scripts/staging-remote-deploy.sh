#!/usr/bin/env bash
# Deploy to Staging LXC from your Mac (same LAN as 192.168.31.53).
#
# Usage:
#   bash scripts/staging-remote-deploy.sh cursor/poker-rules-6max-9b0a
#   bash scripts/staging-remote-deploy.sh main
#   STAGING_IP=192.168.31.53 bash scripts/staging-remote-deploy.sh
#
# Requires: ssh access to uoto@STAGING_IP (see docs/MAC-MINI-操作指南.md)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING_IP="${STAGING_IP:-192.168.31.53}"
STAGING_USER="${STAGING_USER:-uoto}"
STAGING_REPO="${STAGING_REPO:-~/Texas-Hold-em}"
BRANCH="${1:-main}"
EXPECTED_ROOM_VERSION="${EXPECTED_ROOM_VERSION:-0.4.8}"

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

UPDATE_SCRIPT="${ROOT}/scripts/staging-update-no-git.sh"
if [ ! -f "$UPDATE_SCRIPT" ] || ! grep -q "${EXPECTED_ROOM_VERSION}" "$UPDATE_SCRIPT"; then
  echo "==> Local update script missing or stale — downloading from ${BRANCH}"
  UPDATE_SCRIPT="/tmp/staging-update-no-git.sh"
  fetched=0
  for url in \
    "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/${BRANCH}/scripts/staging-update-no-git.sh" \
    "https://cdn.jsdelivr.net/gh/abutang-droid/Texas-Hold-em@${BRANCH}/scripts/staging-update-no-git.sh" \
    "https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/${BRANCH}/scripts/staging-update-no-git.sh"
  do
    if curl -fsSL --retry 2 --connect-timeout 20 -o "$UPDATE_SCRIPT" "$url"; then
      fetched=1
      break
    fi
  done
  if [ "$fetched" -ne 1 ]; then
    echo "ERROR: could not download staging-update-no-git.sh" >&2
    exit 1
  fi
fi

echo "==> Uploading update script to server"
scp "${SSH_OPTS[@]}" "$UPDATE_SCRIPT" \
  "${STAGING_USER}@${STAGING_IP}:${STAGING_REPO}/scripts/staging-update-no-git.sh"

ZIP_URL="https://ghfast.top/https://github.com/abutang-droid/Texas-Hold-em/archive/refs/heads/${BRANCH}.zip"
echo "==> Running staging-update-no-git.sh on server..."
ssh "${SSH_OPTS[@]}" "${STAGING_USER}@${STAGING_IP}" \
  "cd ${STAGING_REPO} && ZIP_URL='${ZIP_URL}' EXPECTED_ROOM_VERSION='${EXPECTED_ROOM_VERSION}' bash scripts/staging-update-no-git.sh '${BRANCH}'"

echo ""
echo "==> Verifying from Mac..."
API_HEALTH="$(curl -sf --connect-timeout 5 "http://${STAGING_IP}:3000/health" || true)"
ROOM_HEALTH="$(curl -sf --connect-timeout 5 "http://${STAGING_IP}:3001/health" || true)"
echo "API  ${API_HEALTH:-FAIL}"
echo "Room ${ROOM_HEALTH:-FAIL}"

if ! echo "${ROOM_HEALTH}" | grep -q "\"version\":\"${EXPECTED_ROOM_VERSION}\""; then
  echo "ERROR: Room health is not ${EXPECTED_ROOM_VERSION}" >&2
  echo "       On server run: bash scripts/staging-redeploy-room.sh" >&2
  exit 1
fi

if [ -f "${ROOT}/scripts/mac-staging-check.sh" ]; then
  bash "${ROOT}/scripts/mac-staging-check.sh" || true
fi

echo ""
echo "✓ Deploy complete. Room ${EXPECTED_ROOM_VERSION} live."
echo "  Admin: http://${STAGING_IP}:5173"
echo "  Next:  bash scripts/mac-mobile-dev.sh"
