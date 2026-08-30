#!/usr/bin/env bash
# Mac mini：启动 Expo 客户端，连接局域网 Staging（192.168.31.53）
set -euo pipefail

MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd "$(dirname "${MAC_SCRIPT_SELF}")" && pwd)"
# shellcheck source=lib/mac-common.sh
source "${SCRIPT_DIR}/lib/mac-common.sh"

ROOT="$(require_repo_root "${MAC_SCRIPT_SELF}")"
cd "${ROOT}"

if ! command -v node >/dev/null; then
  echo "请先安装 Node 20: brew install node@20" >&2
  exit 1
fi
require_pnpm

bash scripts/mac-staging-check.sh
ensure_mobile_env "${ROOT}"
ensure_workspace_deps "${ROOT}"

echo ">>> pnpm build"
pnpm build

echo ""
echo ">>> 启动 Expo（连接 Staging）"
echo "    API:  $(grep EXPO_PUBLIC_API_URL apps/mobile/.env)"
echo "    Room: $(grep EXPO_PUBLIC_ROOM_URL apps/mobile/.env)"
echo ""

clear_expo_cache "${ROOT}"
start_expo_dev_server "${ROOT}"
