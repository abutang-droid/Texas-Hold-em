#!/usr/bin/env bash
# Texas Hold'em · Staging 一键安装（独立 LXC 192.168.31.53）
# 用法: curl -fsSL ... | bash   或   bash scripts/staging-install-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="/tmp/th-staging-install.log"
exec > >(tee -a "$LOG") 2>&1

echo "=============================================="
echo " Texas Hold'em Staging Install"
echo " $(date -Iseconds)"
echo " Host: $(hostname) · IP: $(hostname -I 2>/dev/null || echo '?')"
echo " Log: $LOG"
echo "=============================================="

step() { echo ""; echo ">>> $1"; }

# --- 0. 依赖检查 ---
step "检查 root / Docker / Node"
if [ "$(id -u)" -ne 0 ] && ! command -v docker >/dev/null; then
  echo "请先运行: sudo bash scripts/staging-bootstrap.sh"
  exit 1
fi

if ! command -v docker >/dev/null; then
  step "运行 staging-bootstrap"
  bash scripts/staging-bootstrap.sh
fi

if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  echo "需要 Node 20，当前: $(node -v 2>/dev/null || echo missing)"
  exit 1
fi

# --- 1. .env ---
step "配置 .env"
if [ ! -f .env ]; then
  cp infra/staging/.env.lan.example .env
fi

if grep -q 'CHANGE_ME_staging_jwt_secret' .env 2>/dev/null; then
  JWT=$(openssl rand -hex 32)
  ADMIN=$(openssl rand -hex 16)
  sed -i "s/JWT_SECRET=CHANGE_ME_staging_jwt_secret/JWT_SECRET=${JWT}/" .env
  sed -i "s/ADMIN_API_KEY=CHANGE_ME_admin_key/ADMIN_API_KEY=${ADMIN}/" .env
  echo "已自动生成 JWT_SECRET 与 ADMIN_API_KEY（见 .env）"
fi

# 同步本机 IP 到 .env（若与模板不同）
LAN_IP=$(hostname -I | awk '{print $1}')
if [ -n "$LAN_IP" ]; then
  sed -i "s|STAGING_LAN_IP=.*|STAGING_LAN_IP=${LAN_IP}|" .env
  sed -i "s|ROOM_SERVER_URL=http://[0-9.]*:|ROOM_SERVER_URL=http://${LAN_IP}:|" .env
  sed -i "s|EXPO_PUBLIC_API_URL=http://[0-9.]*:|EXPO_PUBLIC_API_URL=http://${LAN_IP}:|" .env
  sed -i "s|EXPO_PUBLIC_ROOM_URL=http://[0-9.]*:|EXPO_PUBLIC_ROOM_URL=http://${LAN_IP}:|" .env
  echo "LAN IP 已写入 .env: ${LAN_IP}"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

# --- 2. Docker ---
step "启动 Postgres + Redis"
docker compose up -d
sleep 3
docker compose ps

# --- 3. 构建 ---
step "pnpm install & build"
pnpm install
pnpm build

step "数据库迁移"
pnpm migrate || bash scripts/migrate.sh

# --- 4. PM2 ---
step "启动 API / Room / Admin"
bash scripts/staging-up.sh

# --- 5. 健康检查 ---
step "健康检查"
sleep 2
API_P="${API_PORT:-3000}"
ROOM_P="${ROOM_PORT:-3001}"
ADMIN_P="${ADMIN_PORT:-5173}"

curl -sf "http://127.0.0.1:${API_P}/health" && echo " API OK" || echo " API FAIL"
curl -sf "http://127.0.0.1:${ROOM_P}/health" && echo " Room OK" || echo " Room FAIL"

echo ""
echo "=============================================="
echo " 安装完成"
echo " API:   http://${LAN_IP}:${API_P}/health"
echo " Room:  http://${LAN_IP}:${ROOM_P}/health"
echo " Admin: http://${LAN_IP}:${ADMIN_P}"
echo " ADMIN_API_KEY 见 .env"
echo ""
echo " 请把本文件发给协助方排查:"
echo "   cat $LOG"
echo "=============================================="
