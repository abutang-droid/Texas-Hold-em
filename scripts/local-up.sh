#!/usr/bin/env bash
# Start local infrastructure and prepare environment for development
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed. Install Docker Desktop or docker-ce first." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

echo "Starting PostgreSQL + Redis..."
docker compose up -d

chmod +x scripts/wait-for-services.sh scripts/migrate.sh
./scripts/wait-for-services.sh
./scripts/migrate.sh

echo ""
echo "============================================"
echo " Local environment is ready!"
echo "============================================"
echo ""
echo " Start services (separate terminals):"
echo "   pnpm dev:api      # http://localhost:3000/health"
echo "   pnpm dev:room     # http://localhost:3001/health"
echo "   pnpm dev:admin    # http://localhost:5173"
echo "   pnpm dev:mobile   # Expo"
echo ""
echo " Smoke test:"
echo "   pnpm smoke"
echo ""
echo " Admin login key: \${ADMIN_API_KEY} from .env"
echo "============================================"
