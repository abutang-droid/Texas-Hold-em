#!/usr/bin/env bash
# Mac mini：启动 Expo 客户端，连接局域网 Staging（192.168.31.53）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null; then
  echo "请先安装 Node 20: brew install node@20" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null; then
  echo "请先安装 pnpm: npm install -g pnpm@10" >&2
  exit 1
fi

# 连通性
bash scripts/mac-staging-check.sh

# 移动端环境变量
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ensure-mobile-env.sh
source "${SCRIPT_DIR}/lib/ensure-mobile-env.sh"
ensure_mobile_env "$ROOT"

echo ">>> pnpm install & build"
pnpm install
pnpm build

echo ""
echo ">>> 启动 Expo（连接 Staging）"
echo "    API:  $(grep EXPO_PUBLIC_API_URL apps/mobile/.env)"
echo "    Room: $(grep EXPO_PUBLIC_ROOM_URL apps/mobile/.env)"
echo ""
echo "  Web:    按 w 或打开 http://localhost:8081"
echo "  真机:   同一 WiFi 下用 Expo Go 扫码"
echo ""

cd apps/mobile
exec npx expo start --clear
