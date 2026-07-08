#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v docker >/dev/null 2>&1; then
  docker compose down
  echo "Stopped docker compose services."
else
  echo "Docker not found; nothing to stop."
fi
