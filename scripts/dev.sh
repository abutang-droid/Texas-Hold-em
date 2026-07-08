#!/usr/bin/env bash
# Run a dev service with .env loaded (macOS / Linux)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

case "${1:-}" in
  api)   exec pnpm dev:api ;;
  room)  exec pnpm dev:room ;;
  admin) exec pnpm dev:admin ;;
  mobile) exec pnpm dev:mobile ;;
  *)
    echo "Usage: $0 {api|room|admin|mobile}" >&2
    exit 1
    ;;
esac
