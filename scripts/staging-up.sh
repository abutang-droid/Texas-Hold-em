#!/usr/bin/env bash
# Start Staging stack (DB must already be up)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env — copy infra/staging/.env.lan.example or .env.lan.shared.example" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

SHARED="${STAGING_SHARED_HOST:-0}"
COMPOSE=(docker compose -f docker-compose.yml)
PM2_CFG="infra/staging/ecosystem.config.cjs"

if [ "$SHARED" = "1" ]; then
  COMPOSE+=(-f infra/staging/docker-compose.shared.yml)
  PM2_CFG="infra/staging/ecosystem.shared.config.cjs"
  echo "==> Shared-host mode (custom ports, see .env)"
fi

echo "==> Docker (Postgres + Redis)"
"${COMPOSE[@]}" up -d

if [ ! -d apps/api/dist ]; then
  echo "Run: pnpm install && pnpm build" >&2
  exit 1
fi

echo "==> PM2 (api + room + admin)"
export ADMIN_PORT="${ADMIN_PORT:-5173}"
pm2 startOrRestart "$PM2_CFG" --update-env
pm2 save

API_P="${API_PORT:-3000}"
ROOM_P="${ROOM_PORT:-3001}"
ADMIN_P="${ADMIN_PORT:-5173}"

echo ""
echo "Local health:"
curl -sf "http://127.0.0.1:${API_P}/health" && echo " API OK (:${API_P})" || echo " API FAIL (:${API_P})"
curl -sf "http://127.0.0.1:${ROOM_P}/health" && echo " Room OK (:${ROOM_P})" || echo " Room FAIL (:${ROOM_P})"
echo ""
echo "Admin: http://${STAGING_LAN_IP:-127.0.0.1}:${ADMIN_P}"
echo "Mac/Expo:"
echo "  EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL:-http://127.0.0.1:${API_P}}"
echo "  EXPO_PUBLIC_ROOM_URL=${EXPO_PUBLIC_ROOM_URL:-http://127.0.0.1:${ROOM_P}}"
