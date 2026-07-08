#!/usr/bin/env bash
# Start PostgreSQL + Redis via Homebrew (no Docker) and run migrations
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v brew >/dev/null 2>&1; then
  echo "Error: Homebrew is required. Install from https://brew.sh" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "Starting PostgreSQL 16 + Redis..."
brew services start postgresql@16 2>/dev/null || true
brew services start redis 2>/dev/null || true

export PATH="/opt/homebrew/opt/postgresql@16/bin:/usr/local/opt/postgresql@16/bin:$PATH"

echo "Ensuring database user and database..."
psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='th'" | grep -q 1 \
  || psql postgres -c "CREATE USER th WITH PASSWORD 'th_pass' CREATEDB;"
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='texas_holdem'" | grep -q 1 \
  || psql postgres -c "CREATE DATABASE texas_holdem OWNER th;"

chmod +x scripts/wait-for-services.sh scripts/migrate.sh
./scripts/wait-for-services.sh
./scripts/migrate.sh

echo ""
echo "============================================"
echo " Mac local DB is ready (Homebrew)"
echo "============================================"
echo ""
echo " Next (separate terminals):"
echo "   bash scripts/dev.sh api"
echo "   bash scripts/dev.sh room"
echo "   bash scripts/dev.sh admin"
echo "   bash scripts/dev.sh mobile"
echo ""
echo " Then: pnpm build && pnpm smoke"
echo "============================================"
