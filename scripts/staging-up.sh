#!/usr/bin/env bash
# Start Staging stack (DB must already be up)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env — copy infra/staging/.env.staging.example first" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Docker (Postgres + Redis)"
docker compose up -d

if [ ! -d apps/api/dist ]; then
  echo "Run: pnpm install && pnpm build" >&2
  exit 1
fi

echo "==> PM2 (api + room + admin)"
pm2 startOrRestart infra/staging/ecosystem.config.cjs
pm2 save

echo ""
echo "Local health:"
curl -sf "http://127.0.0.1:${API_PORT:-3000}/health" && echo " API OK" || echo " API FAIL"
curl -sf "http://127.0.0.1:${ROOM_PORT:-3001}/health" && echo " Room OK" || echo " Room FAIL"
echo ""
echo "Public (after tunnel):"
echo "  ${EXPO_PUBLIC_API_URL:-https://api-staging.yourdomain.com}/health"
echo "  ${EXPO_PUBLIC_ROOM_URL:-https://room-staging.yourdomain.com}/health"
