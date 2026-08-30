#!/usr/bin/env bash
# Ensure apps/mobile/.env exists (works when .env.staging.example was not synced).
ensure_mobile_env() {
  local root="$1"
  local env_file="${root}/apps/mobile/.env"
  local example="${root}/apps/mobile/.env.staging.example"

  if [ -f "$env_file" ]; then
    return 0
  fi

  mkdir -p "${root}/apps/mobile"

  if [ -f "$example" ]; then
    cp "$example" "$env_file"
    echo "Created apps/mobile/.env from .env.staging.example"
    return 0
  fi

  cat > "$env_file" <<'EOF'
# Staging LAN (192.168.31.53) — auto-created by mac-mobile-dev.sh
EXPO_PUBLIC_API_URL=http://192.168.31.53:3000
EXPO_PUBLIC_ROOM_URL=http://192.168.31.53:3001
EOF
  echo "Created apps/mobile/.env (default staging URLs)"
}
