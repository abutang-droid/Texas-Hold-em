#!/usr/bin/env bash
# Reset weekly leaderboards (run via cron: 0 0 * * 1 — every Monday 00:00)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Resetting weekly leaderboards..."
npx tsx -e "
import { resetWeeklyLeaderboards, buildDualLeaderboard, closeRedis, closePool } from '@texas-holdem/db';
await resetWeeklyLeaderboards();
await buildDualLeaderboard(10);
await closeRedis();
await closePool();
console.log('Leaderboards reset and cache rebuilt.');
"
