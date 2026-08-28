#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pm2 stop infra/staging/ecosystem.config.cjs 2>/dev/null || pm2 delete th-api th-room th-admin 2>/dev/null || true
echo "PM2 stopped. Docker left running (use: docker compose down)"
