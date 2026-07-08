#!/usr/bin/env bash
# Apply pending SQL migrations (idempotent via IF NOT EXISTS in files)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PGPASSWORD="${POSTGRES_PASSWORD:-th_pass}"
export PGPASSWORD

PSQL=(psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-th}" -d "${POSTGRES_DATABASE:-texas_holdem}" -v ON_ERROR_STOP=1)

echo "Applying migrations..."
for f in "$ROOT"/infra/migrations/*.sql; do
  echo "  -> $(basename "$f")"
  "${PSQL[@]}" -f "$f" || true
done

echo "Migrations done."
