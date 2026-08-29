#!/usr/bin/env bash
# Rebuild and restart API after git pull (fixes stale dist / 404 on new routes)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "==> Branch: $(git branch --show-current 2>/dev/null || echo unknown)"

if ! grep -q "auth/register" apps/api/src/main.ts 2>/dev/null; then
  echo "ERROR: apps/api/src/main.ts has no auth/register — run: git pull origin main" >&2
  exit 1
fi

echo "==> pnpm install"
pnpm install

echo "==> pnpm build"
pnpm build

echo "==> migrate"
pnpm migrate || bash scripts/migrate.sh

if grep -q "auth/register" apps/api/dist/main.js 2>/dev/null; then
  echo "OK: dist/main.js contains auth/register"
else
  echo "ERROR: build failed — auth/register missing from apps/api/dist/main.js" >&2
  exit 1
fi

echo "==> PM2 restart"
pm2 startOrRestart infra/staging/ecosystem.config.cjs --only th-api --update-env
pm2 save

sleep 2
API_P="${API_PORT:-3000}"
echo ""
echo "==> Health:"
curl -sf "http://127.0.0.1:${API_P}/health" && echo "" || echo "API health FAIL"

echo "==> Register probe:"
curl -sf -X POST "http://127.0.0.1:${API_P}/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"probe-$(date +%s)@example.com\",\"password\":\"testpass8\",\"nickname\":\"Probe\"}" \
  | head -c 120 && echo ""

echo ""
echo "Done. If register still 404, check: pm2 describe th-api | grep -E 'cwd|script|status'"
