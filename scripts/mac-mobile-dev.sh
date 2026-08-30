#!/usr/bin/env bash
# Start Expo web dev server (Mac). Builds shared package first to avoid Metro 500.
#
#   cd ~/Texas-Hold-em && bash scripts/mac-mobile-dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f apps/mobile/.env ]; then
  cp apps/mobile/.env.staging.example apps/mobile/.env
  echo "Created apps/mobile/.env from staging example"
fi

echo "==> Build workspace packages used by mobile"
pnpm --filter @texas-holdem/shared build

echo "==> Clear Metro cache"
rm -rf apps/mobile/.expo apps/mobile/node_modules/.cache

echo "==> Start Expo (web: http://localhost:8081)"
cd apps/mobile
exec npx expo start --clear
