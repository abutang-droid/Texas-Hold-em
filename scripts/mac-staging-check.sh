#!/usr/bin/env bash
# Mac mini：检查与 Staging 服务器（默认 192.168.31.53）的连通性
set -euo pipefail

STAGING_IP="${STAGING_IP:-192.168.31.53}"
API_PORT="${API_PORT:-3000}"
ROOM_PORT="${ROOM_PORT:-3001}"
ADMIN_PORT="${ADMIN_PORT:-5173}"

echo "=== Texas Hold'em · Mac → Staging 连通检查 ==="
echo "目标: ${STAGING_IP}"
echo ""

fail=0

if ping -c 1 -W 2 "${STAGING_IP}" >/dev/null 2>&1; then
  echo "✓ Ping ${STAGING_IP}"
else
  echo "✗ Ping 失败 — 确认 Mac 与服务器同一 WiFi"
  fail=1
fi

check_http() {
  local name=$1 port=$2 path=${3:-/health}
  local url="http://${STAGING_IP}:${port}${path}"
  if curl -sf --connect-timeout 3 "${url}" >/dev/null; then
    echo "✓ ${name}  ${url}"
    curl -s "${url}" | head -c 120
    echo ""
  else
    echo "✗ ${name}  ${url} — 服务未启动或端口未开放"
    fail=1
  fi
}

check_http "API  " "${API_PORT}"
check_http "Room " "${ROOM_PORT}"
check_http "Admin" "${ADMIN_PORT}" "/"

echo ""
if [ "$fail" -eq 0 ]; then
  echo "全部通过。可启动客户端: bash scripts/mac-start-mobile.sh"
else
  echo "请先在本机 Staging 服务器执行: sudo bash scripts/staging-install-all.sh"
  exit 1
fi
