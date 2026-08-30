#!/usr/bin/env bash
# Rebuild and restart Room only (fixes stale dist / old health version).
# Run on staging after git pull or when curl :3001/health still shows 0.4.1.
#
#   cd ~/Texas-Hold-em && bash scripts/staging-redeploy-room.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPECTED_ROOM_VERSION="${EXPECTED_ROOM_VERSION:-0.4.7}"
ROOM_P="${ROOM_PORT:-3001}"

echo "==> Texas Hold'em — Room redeploy"
echo "    Root: ${ROOT}"
echo "    Expected version: ${EXPECTED_ROOM_VERSION}"

if [ ! -f apps/room/src/main.ts ]; then
  echo "ERROR: apps/room/src/main.ts missing — wrong directory?" >&2
  exit 1
fi

if ! grep -q "version: '${EXPECTED_ROOM_VERSION}'" apps/room/src/main.ts; then
  SRC_VER="$(grep -o "version: '[0-9.]*'" apps/room/src/main.ts | head -1 || true)"
  echo "ERROR: source is ${SRC_VER:-unknown}, expected ${EXPECTED_ROOM_VERSION}" >&2
  echo "       Run deploy first: bash scripts/staging-server-deploy.sh main" >&2
  exit 1
fi

echo "==> Clean room + package dist"
rm -rf apps/room/dist packages/db/dist packages/shared/dist packages/poker-engine/dist

echo "==> pnpm install"
pnpm install

echo "==> Build workspace (room depends on packages/*)"
pnpm build

if ! grep -q "${EXPECTED_ROOM_VERSION}" apps/room/dist/main.js; then
  echo "ERROR: apps/room/dist/main.js missing version ${EXPECTED_ROOM_VERSION}" >&2
  echo "       dist may be stale — check: ls -la apps/room/dist/main.js" >&2
  exit 1
fi

echo "==> PM2 restart th-room only"
pm2 startOrRestart infra/staging/ecosystem.config.cjs --only th-room --update-env
pm2 save

sleep 2
echo ""
echo "==> Room health:"
HEALTH="$(curl -sf "http://127.0.0.1:${ROOM_P}/health" || true)"
echo "${HEALTH:-Room health FAIL}"

if ! echo "${HEALTH}" | grep -q "\"version\":\"${EXPECTED_ROOM_VERSION}\""; then
  echo "" >&2
  echo "ERROR: Room still not on ${EXPECTED_ROOM_VERSION}" >&2
  echo "  pm2 describe th-room | grep -E 'cwd|script|status|restarts'" >&2
  echo "  pm2 logs th-room --lines 40 --nostream" >&2
  exit 1
fi

echo ""
echo "Done. Room ${EXPECTED_ROOM_VERSION} is live on port ${ROOM_P}."
