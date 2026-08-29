#!/usr/bin/env bash
# Apply pending SQL migrations (idempotent via IF NOT EXISTS in files)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PGPASSWORD="${POSTGRES_PASSWORD:-th_pass}"
export PGPASSWORD

DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-th}"
DB_NAME="${POSTGRES_DATABASE:-texas_holdem}"

run_psql_file() {
  local file="$1"
  if command -v psql >/dev/null 2>&1; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx th-postgres; then
    docker exec -i th-postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$file"
    return
  fi
  echo "WARN: psql not found and th-postgres container not running — skipping migrations" >&2
  echo "       Install postgresql-client or start Docker Postgres, then re-run: pnpm migrate" >&2
  exit 0
}

echo "Applying migrations..."
for f in "$ROOT"/infra/migrations/*.sql; do
  echo "  -> $(basename "$f")"
  run_psql_file "$f"
done

echo "Migrations done."
