#!/usr/bin/env bash
# Install cloudflared as systemd service (needs CLOUDFLARE_TUNNEL_TOKEN in .env)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  echo "Set CLOUDFLARE_TUNNEL_TOKEN in .env (from Cloudflare Zero Trust → Tunnels)" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash scripts/staging-tunnel-install.sh" >&2
  exit 1
fi

install -d -m 0755 /etc/cloudflared
echo "${CLOUDFLARE_TUNNEL_TOKEN}" > /etc/cloudflared/tunnel.token
chmod 600 /etc/cloudflared/tunnel.token

cat > /etc/systemd/system/cloudflared.service <<'UNIT'
[Unit]
Description=Cloudflare Tunnel (Texas Hold'em Staging)
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/bin/cloudflared tunnel run --token $(cat /etc/cloudflared/tunnel.token)
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

# systemd does not expand $(cat ...) in ExecStart — use EnvironmentFile instead
cat > /etc/systemd/system/cloudflared.service <<UNIT
[Unit]
Description=Cloudflare Tunnel (Texas Hold'em Staging)
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/cloudflared/tunnel.env
ExecStart=/usr/bin/cloudflared tunnel run --token \${TUNNEL_TOKEN}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

echo "TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}" > /etc/cloudflared/tunnel.env
chmod 600 /etc/cloudflared/tunnel.env

systemctl daemon-reload
systemctl enable --now cloudflared
systemctl status cloudflared --no-pager

echo ""
echo "Tunnel running. Verify public URLs in Cloudflare dashboard."
