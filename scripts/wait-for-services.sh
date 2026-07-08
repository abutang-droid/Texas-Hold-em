#!/usr/bin/env bash
# Wait for PostgreSQL and Redis to be ready
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-th}"
POSTGRES_DATABASE="${POSTGRES_DATABASE:-texas_holdem}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
for i in $(seq 1 60); do
  if PGPASSWORD="${POSTGRES_PASSWORD:-th_pass}" pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "PostgreSQL not ready after 60s" >&2
    exit 1
  fi
  sleep 1
done

echo "Waiting for Redis..."
for i in $(seq 1 30); do
  if redis-cli -u "$REDIS_URL" ping 2>/dev/null | grep -q PONG; then
    echo "Redis is ready."
    exit 0
  fi
  if [ "$i" -eq 30 ]; then
    echo "Redis not ready after 30s" >&2
    exit 1
  fi
  sleep 1
done
