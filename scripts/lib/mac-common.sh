#!/usr/bin/env bash
# Shared helpers for Mac mobile scripts. Safe to source from repo scripts/ or /tmp after bootstrap.
#
# Usage (from any mac-*.sh):
#   MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
#   # shellcheck source=lib/mac-common.sh
#   source "$(mac_find_lib "$MAC_SCRIPT_SELF")"

MIRROR_BASE_DEFAULT='https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/main'

# --- repo root (never resolves to / when script lives in /tmp) ---
resolve_repo_root() {
  local script_path="${1:-${BASH_SOURCE[1]:-$0}}"

  if [ -n "${TH_REPO_ROOT:-}" ] && [ -f "${TH_REPO_ROOT}/apps/mobile/app/index.tsx" ]; then
    (cd "${TH_REPO_ROOT}" && pwd)
    return 0
  fi

  if [ -f "${PWD}/apps/mobile/app/index.tsx" ]; then
    (cd "${PWD}" && pwd)
    return 0
  fi

  local script_dir
  script_dir="$(cd "$(dirname "$script_path")" && pwd)"
  if [ "${script_dir}" != "/tmp" ] && [ -f "${script_dir}/../apps/mobile/app/index.tsx" ]; then
    (cd "${script_dir}/.." && pwd)
    return 0
  fi

  if [ -f "${HOME}/Texas-Hold-em/apps/mobile/app/index.tsx" ]; then
    (cd "${HOME}/Texas-Hold-em" && pwd)
    return 0
  fi

  echo "ERROR: cannot find Texas-Hold-em repo (need apps/mobile/app/index.tsx)." >&2
  echo "  cd ~/Texas-Hold-em" >&2
  echo "  bash ${script_path}" >&2
  return 1
}

require_repo_root() {
  local root
  root="$(resolve_repo_root "$1")" || exit 1
  if [ "${root}" = "/" ]; then
    echo "ERROR: repo root must not be / — cd ~/Texas-Hold-em first." >&2
    exit 1
  fi
  printf '%s\n' "${root}"
}

# --- .env (never fails if example file missing) ---
ensure_mobile_env() {
  local root="$1"
  local env_file="${root}/apps/mobile/.env"
  local example="${root}/apps/mobile/.env.staging.example"

  if [ -f "${env_file}" ]; then
    return 0
  fi

  mkdir -p "${root}/apps/mobile"

  if [ -f "${example}" ]; then
    cp "${example}" "${env_file}"
    echo "==> Created apps/mobile/.env from .env.staging.example"
    return 0
  fi

  cat > "${env_file}" <<'EOF'
# Staging LAN — auto-created by mac scripts
EXPO_PUBLIC_API_URL=http://192.168.31.53:3000
EXPO_PUBLIC_ROOM_URL=http://192.168.31.53:3001
EOF
  echo "==> Created apps/mobile/.env (default staging URLs)"
}

# --- dependencies ---
require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: node not found. Install: brew install node@20" >&2
    exit 1
  fi
}

require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "ERROR: pnpm not found. Install: npm install -g pnpm@10" >&2
    exit 1
  fi
}

ensure_workspace_deps() {
  local root="$1"
  require_node
  require_pnpm
  cd "${root}"

  if [ ! -d node_modules ]; then
    echo "==> Installing dependencies (node_modules missing — first run?)"
    pnpm install
    return 0
  fi

  if [ ! -x node_modules/.bin/expo ] && [ ! -f apps/mobile/node_modules/.bin/expo ] 2>/dev/null; then
    echo "==> Installing dependencies (expo CLI missing)"
    pnpm install
  fi
}

build_shared_package() {
  require_pnpm
  echo "==> Building @texas-holdem/shared"
  pnpm --filter @texas-holdem/shared build
}

free_expo_port() {
  local port="${1:-8081}"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "==> Port ${port} is in use — stopping old Metro/Expo"
    lsof -tiTCP:"${port}" -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

# Crash: "me is not defined" in applySnapshot. Pin the known-good file.
ensure_table_snapshot_fix() {
  local root="$1"
  local dest="${root}/apps/mobile/app/table.tsx"
  if grep -q 'applySnapshotMeFix' "${dest}" 2>/dev/null \
    && grep -q 'sitDownWebConfirm' "${dest}" 2>/dev/null; then
    echo "OK table.tsx has applySnapshotMeFix + sitDownWebConfirm"
    return 0
  fi
  echo "==> table.tsx is stale — replacing sit/snapshot fix from branch"
  local slug="abutang-droid/Texas-Hold-em"
  local ref="cursor/poker-rules-6max-9b0a"
  local stamp
  stamp="$(date +%s)"
  local url
  for url in \
    "https://raw.githubusercontent.com/${slug}/${ref}/apps/mobile/app/table.tsx?t=${stamp}" \
    "https://ghfast.top/https://raw.githubusercontent.com/${slug}/${ref}/apps/mobile/app/table.tsx" \
    "https://raw.gitmirror.com/${slug}/${ref}/apps/mobile/app/table.tsx"
  do
    if curl -fsSL --globoff --retry 2 --connect-timeout 20 -o "${dest}.tmp" "$url"; then
      mv "${dest}.tmp" "${dest}"
      break
    fi
    rm -f "${dest}.tmp"
  done
  if ! grep -q 'applySnapshotMeFix' "${dest}" 2>/dev/null \
    || ! grep -q 'sitDownWebConfirm' "${dest}" 2>/dev/null; then
    echo "ERROR: could not install fixed table.tsx — Expo would still crash / fail to sit" >&2
    return 1
  fi
  echo "OK replaced table.tsx"
  local alertDest="${root}/apps/mobile/src/utils/alert.ts"
  if ! grep -q 'export function showConfirm' "${alertDest}" 2>/dev/null; then
    echo "==> Replacing alert.ts (web confirm for sit-down)"
    for url in \
      "https://raw.githubusercontent.com/${slug}/${ref}/apps/mobile/src/utils/alert.ts?t=${stamp}" \
      "https://ghfast.top/https://raw.githubusercontent.com/${slug}/${ref}/apps/mobile/src/utils/alert.ts"
    do
      if curl -fsSL --globoff --retry 2 --connect-timeout 20 -o "${alertDest}.tmp" "$url"; then
        mv "${alertDest}.tmp" "${alertDest}"
        break
      fi
      rm -f "${alertDest}.tmp"
    done
  fi
}

start_expo_dev_server() {
  local root="$1"
  local port="${EXPO_PORT:-8081}"

  if [ ! -d "${root}/apps/mobile" ]; then
    echo "ERROR: apps/mobile not found under ${root}" >&2
    return 1
  fi

  free_expo_port "${port}"

  echo ""
  echo "============================================"
  echo " Starting Expo (Metro)"
  echo "============================================"
  echo "  Root: ${root}"
  echo "  Web:  http://localhost:${port}"
  echo "  Login path: http://localhost:${port}/auth/login"
  echo ""
  echo "  In this terminal: press w to open web browser"
  echo "  Stop server: Ctrl+C"
  echo "============================================"
  echo ""

  cd "${root}/apps/mobile"
  # --port avoids interactive prompt when 8081 was taken; free_expo_port handles stale Metro.
  exec npx expo start --clear --port "${port}"
}

clear_expo_cache() {
  local root="$1"
  rm -rf "${root}/apps/mobile/.expo" "${root}/apps/mobile/node_modules/.cache"
  echo "==> Cleared Expo / Metro cache"
}

# --- mirror sync ---
mac_mirror_base() {
  printf '%s\n' "${MIRROR_BASE:-${MIRROR_BASE_DEFAULT}}"
}

download_repo_file() {
  local root="$1"
  local rel="$2"
  local base
  base="$(mac_mirror_base)"
  local dest="${root}/${rel}"
  mkdir -p "$(dirname "${dest}")"
  if ! curl -fsSL --retry 2 "${base}/${rel}" -o "${dest}.tmp"; then
    echo "ERROR: download failed: ${rel}" >&2
    rm -f "${dest}.tmp"
    return 1
  fi
  mv "${dest}.tmp" "${dest}"
  echo "  -> ${rel}"
}

# Files required for mobile dev after a partial git pull / mirror sync.
mac_mobile_sync_files() {
  cat <<'EOF'
apps/mobile/metro.config.js
apps/mobile/package.json
apps/mobile/app.json
apps/mobile/babel.config.js
apps/mobile/.env.staging.example
apps/mobile/app/_layout.tsx
apps/mobile/app/index.tsx
apps/mobile/app/onboarding.tsx
apps/mobile/app/private.tsx
apps/mobile/app/table.tsx
apps/mobile/app/tables.tsx
apps/mobile/src/types/table.ts
apps/mobile/app/auth/_layout.tsx
apps/mobile/app/auth/login.tsx
apps/mobile/app/auth/register.tsx
apps/mobile/src/api/client.ts
apps/mobile/src/storage/onboarding.ts
apps/mobile/src/storage/session.ts
apps/mobile/src/auth/routes.ts
apps/mobile/src/i18n/index.ts
apps/mobile/src/theme/index.ts
apps/mobile/src/utils/alert.ts
apps/mobile/src/utils/nickname.ts
apps/mobile/src/components/Table9Max.tsx
apps/mobile/src/components/table-layout.ts
apps/mobile/src/components/DealerStation.tsx
apps/mobile/src/components/DealFlyLayer.tsx
apps/mobile/src/components/ShowdownOverlay.tsx
apps/mobile/src/components/ChipFlyLayer.tsx
apps/mobile/src/components/CommunityCardsRow.tsx
apps/mobile/src/components/ActionPanel.tsx
apps/mobile/src/components/TurnTimer.tsx
apps/mobile/src/components/HandStatusBar.tsx
apps/mobile/src/components/PotDisplay.tsx
apps/mobile/src/components/PrivateTablePanels.tsx
apps/mobile/src/components/ui/PlayingCard.tsx
apps/mobile/src/components/ui/GameModal.tsx
apps/mobile/src/components/ui/Button.tsx
apps/mobile/src/components/ui/Screen.tsx
apps/mobile/src/components/ui/Card.tsx
apps/mobile/src/components/auth/AuthField.tsx
apps/mobile/src/components/Avatar.tsx
apps/mobile/src/components/EmojiBar.tsx
apps/mobile/app/shop.tsx
apps/mobile/app/settings.tsx
apps/mobile/app/leaderboard.tsx
apps/mobile/app/profile.tsx
docs/DESIGN-SPEC.md
apps/mobile/src/locales/en-US.json
apps/mobile/src/locales/zh-CN.json
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/index.ts
packages/shared/src/table-config.ts
packages/shared/src/avatars.ts
packages/shared/src/table-emojis.ts
packages/shared/src/design-tokens/colors.json
scripts/lib/mac-common.sh
EOF
}

sync_mobile_from_mirror() {
  local root="$1"
  local rel
  echo "==> Sync mobile + shared from mirror"
  echo "    Root: ${root}"
  echo "    Base: $(mac_mirror_base)"
  while IFS= read -r rel; do
    [ -z "${rel}" ] && continue
    download_repo_file "${root}" "${rel}" || return 1
  done < <(mac_mobile_sync_files)
}

verify_mobile_index() {
  local root="$1"
  if grep -q "router.replace('/auth/login')" "${root}/apps/mobile/app/index.tsx" 2>/dev/null; then
    echo "ERROR: apps/mobile/app/index.tsx is still an old version." >&2
    return 1
  fi
  if [ ! -f "${root}/packages/shared/dist/index.js" ]; then
    echo "ERROR: packages/shared/dist missing — build failed?" >&2
    return 1
  fi
  echo "==> Mobile sources OK"
}

# Locate this library when the entry script may live in /tmp or scripts/.
mac_find_lib() {
  local script_path="${1:-$0}"
  local script_dir root base tmp

  script_dir="$(cd "$(dirname "$script_path")" && pwd)"
  if [ -f "${script_dir}/lib/mac-common.sh" ]; then
    printf '%s\n' "${script_dir}/lib/mac-common.sh"
    return 0
  fi

  if [ -f "${PWD}/scripts/lib/mac-common.sh" ]; then
    printf '%s\n' "${PWD}/scripts/lib/mac-common.sh"
    return 0
  fi

  root="$(resolve_repo_root "$script_path" 2>/dev/null)" || root="${PWD}"
  if [ -f "${root}/scripts/lib/mac-common.sh" ]; then
    printf '%s\n' "${root}/scripts/lib/mac-common.sh"
    return 0
  fi

  base="$(mac_mirror_base)"
  tmp="/tmp/mac-common-$$.sh"
  if curl -fsSL --retry 2 "${base}/scripts/lib/mac-common.sh" -o "${tmp}"; then
    printf '%s\n' "${tmp}"
    return 0
  fi

  echo "ERROR: cannot load scripts/lib/mac-common.sh" >&2
  return 1
}
