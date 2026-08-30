#!/usr/bin/env bash
# Deprecated alias — use mac-sync-mobile.sh
#   cd ~/Texas-Hold-em && bash scripts/mac-update-mobile-files-mirror.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "${SCRIPT_DIR}/mac-sync-mobile.sh" "$@"
