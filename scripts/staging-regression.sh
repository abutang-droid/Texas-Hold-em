#!/usr/bin/env bash
# A3 Staging full regression — run from Mac against 192.168.31.53
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGING_IP="${STAGING_IP:-192.168.31.53}"
API_PORT="${API_PORT:-3000}"
ROOM_PORT="${ROOM_PORT:-3001}"

export API_URL="${API_URL:-http://${STAGING_IP}:${API_PORT}}"
export ROOM_URL="${ROOM_URL:-http://${STAGING_IP}:${ROOM_PORT}}"

echo ">>> Connectivity check"
bash scripts/mac-staging-check.sh

echo ""
echo ">>> API regression (auth / shop / official / private)"
pnpm exec tsx scripts/staging-regression.ts
