#!/usr/bin/env bash
# One-time setup inside Proxmox LXC (Ubuntu 24.04)
set -euo pipefail

echo "==> Texas Hold'em Staging bootstrap"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash scripts/staging-bootstrap.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg git jq

# Docker
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

# Node.js 20 LTS
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# pnpm + pm2
npm install -g pnpm@10 pm2

# cloudflared
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update
  apt-get install -y cloudflared
fi

echo ""
echo "Bootstrap done."
echo "Next:"
echo "  git clone ... && git checkout cursor/phase4-open-beta-2fc9"
echo "  cp infra/staging/.env.staging.example .env && nano .env"
echo "  docker compose up -d && pnpm install && pnpm build && pnpm migrate"
echo "  bash scripts/staging-up.sh"
echo "  bash scripts/staging-tunnel-install.sh"
