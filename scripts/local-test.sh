#!/usr/bin/env bash
# Full local integration smoke test (requires local-up first)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a

export API_URL="${API_URL:-http://localhost:3000}"
export ADMIN_API_KEY="${ADMIN_API_KEY:-dev-admin-key-change-in-production}"

echo "=== API smoke ==="
pnpm smoke

echo ""
echo "=== Admin API smoke ==="
curl -sf -H "Authorization: Bearer ${ADMIN_API_KEY}" "${API_URL}/api/v1/admin/config" | head -c 200
echo ""
curl -sf -H "Authorization: Bearer ${ADMIN_API_KEY}" "${API_URL}/api/v1/admin/economy" | head -c 200
echo ""

echo "=== All smoke checks passed ==="
