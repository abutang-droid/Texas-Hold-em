#!/usr/bin/env bash
# Shared helpers for Mac mobile scripts. Safe to source from repo scripts/ or /tmp after bootstrap.
#
# Usage (from any mac-*.sh):
#   MAC_SCRIPT_SELF="${BASH_SOURCE[0]:-$0}"
#   # shellcheck source=lib/mac-common.sh
#   source "$(mac_find_lib "$MAC_SCRIPT_SELF")"

MAC_COMMON_REV='2026-08-30-r4'
GITHUB_REPO='abutang-droid/Texas-Hold-em'
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

  echo "ERROR: 找不到 Texas-Hold-em 仓库（需要 apps/mobile/app/index.tsx）。" >&2
  echo "  请先: cd ~/Texas-Hold-em" >&2
  echo "  再运行: bash ${script_path}" >&2
  return 1
}

require_repo_root() {
  local root
  root="$(resolve_repo_root "$1")" || exit 1
  if [ "${root}" = "/" ]; then
    echo "ERROR: repo root 不能是 / — 请先 cd ~/Texas-Hold-em" >&2
    exit 1
  fi
  printf '%s\n' "${root}"
}

warn_if_not_mac() {
  local os
  os="$(uname -s 2>/dev/null || echo unknown)"
  if [ "${os}" != "Darwin" ]; then
    echo "WARNING: 当前系统是 ${os}，不是 macOS。" >&2
    echo "  游戏客户端必须在 Mac mini 终端运行，不要在服务器 uoto@tex 上跑本脚本。" >&2
    echo "  若你在 SSH 里，先输入 exit 回到 Mac。" >&2
  fi
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
    echo "ERROR: 未找到 node。请在 Mac 执行: brew install node@20" >&2
    exit 1
  fi
}

require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "ERROR: 未找到 pnpm。请在 Mac 执行: npm install -g pnpm@10" >&2
    exit 1
  fi
}

ensure_workspace_deps() {
  local root="$1"
  require_node
  require_pnpm
  cd "${root}"

  echo "==> pnpm install（已安装时很快）"
  if ! pnpm install; then
    echo "==> npm 源失败，改用 npmmirror 重试"
    pnpm install --registry https://registry.npmmirror.com
  fi

  if [ ! -x "${root}/node_modules/.bin/expo" ] && [ ! -x "${root}/apps/mobile/node_modules/.bin/expo" ]; then
    echo "ERROR: pnpm install 之后仍找不到 expo CLI" >&2
    echo "  node=$(command -v node) $(node -v 2>/dev/null || true)" >&2
    echo "  pnpm=$(command -v pnpm) $(pnpm -v 2>/dev/null || true)" >&2
    exit 1
  fi
}

build_shared_package() {
  require_pnpm
  echo "==> Building @texas-holdem/shared"
  pnpm --filter @texas-holdem/shared build
}

resolve_expo_bin() {
  local root="$1"
  if [ -x "${root}/apps/mobile/node_modules/.bin/expo" ]; then
    printf '%s\n' "${root}/apps/mobile/node_modules/.bin/expo"
    return 0
  fi
  if [ -x "${root}/node_modules/.bin/expo" ]; then
    printf '%s\n' "${root}/node_modules/.bin/expo"
    return 0
  fi
  echo "ERROR: expo 可执行文件不存在，请先 pnpm install" >&2
  return 1
}

free_expo_port() {
  local port="${1:-8081}"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "==> 端口 ${port} 已被占用 — 结束旧的 Metro/Expo"
    lsof -tiTCP:"${port}" -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

open_expo_login() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "${url}" >/dev/null 2>&1 || true
  fi
}

wait_for_metro() {
  local port="$1"
  local pid="$2"
  local max_s="${3:-180}"
  local i http_code

  echo "==> 等待 Metro 就绪 http://localhost:${port} （最多 ${max_s}s）"
  for i in $(seq 1 "${max_s}"); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      echo "ERROR: Expo 进程在 Metro 就绪前退出了。请把上面的完整终端输出发回来。" >&2
      return 1
    fi
    http_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${port}/" 2>/dev/null || true)"
    case "${http_code}" in
      2*|3*|404)
        return 0
        ;;
    esac
    sleep 1
  done
  echo "ERROR: ${max_s}s 内 Metro 没有在 :${port} 监听。请把上面的完整终端输出发回来。" >&2
  return 1
}

start_expo_dev_server() {
  local root="$1"
  local port="${EXPO_PORT:-8081}"
  local expo_bin pid login_url rc

  if [ ! -d "${root}/apps/mobile" ]; then
    echo "ERROR: ${root} 下没有 apps/mobile" >&2
    return 1
  fi

  warn_if_not_mac
  free_expo_port "${port}"
  expo_bin="$(resolve_expo_bin "${root}")" || return 1
  login_url="http://localhost:${port}/auth/login"

  echo ""
  echo "============================================"
  echo " Starting Expo (Metro)  [${MAC_COMMON_REV}]"
  echo "============================================"
  echo "  Root: ${root}"
  echo "  Expo: ${expo_bin}"
  echo "  Web:  http://localhost:${port}"
  echo "  Login: ${login_url}"
  echo ""
  echo "  就绪后会尝试自动打开浏览器。"
  echo "  停止服务: Ctrl+C"
  echo "============================================"
  echo ""

  cd "${root}/apps/mobile"
  unset CI
  export EXPO_NO_TELEMETRY=1
  export BROWSER="${BROWSER:-none}"

  # Foreground logs, but keep a PID so we can detect crash-before-ready.
  "${expo_bin}" start --web --clear --port "${port}" &
  pid=$!
  trap 'kill '"${pid}"' 2>/dev/null || true; wait '"${pid}"' 2>/dev/null || true; exit 130' INT TERM

  if ! wait_for_metro "${port}" "${pid}" 180; then
    trap - INT TERM
    kill "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
    return 1
  fi

  echo ""
  echo "============================================"
  echo " Expo 已启动"
  echo " 请打开: ${login_url}"
  echo "============================================"
  echo ""
  open_expo_login "${login_url}"

  wait "${pid}"
  rc=$?
  trap - INT TERM
  return "${rc}"
}

clear_expo_cache() {
  local root="$1"
  rm -rf "${root}/apps/mobile/.expo" "${root}/apps/mobile/node_modules/.cache"
  echo "==> Cleared Expo / Metro cache"
}

# --- mirror sync ---
mac_git_ref() {
  printf '%s\n' "${MAC_GIT_REF:-main}"
}

mac_mirror_base() {
  printf '%s\n' "${MIRROR_BASE:-${MIRROR_BASE_DEFAULT}}"
}

# Encode [ ] in paths. curl treats [code] as a glob range ("bad range in URL").
mac_urlencode_path() {
  local rel="$1"
  local out="" c i
  i=0
  while [ "${i}" -lt "${#rel}" ]; do
    c="${rel:${i}:1}"
    case "${c}" in
      '[') out="${out}%5B" ;;
      ']') out="${out}%5D" ;;
      ' ') out="${out}%20" ;;
      *) out="${out}${c}" ;;
    esac
    i=$((i + 1))
  done
  printf '%s' "${out}"
}

# Candidate raw-file URLs for a repo-relative path. ghfast first (CN), then other CDNs.
mac_raw_urls() {
  local rel="$1"
  local ref enc
  ref="$(mac_git_ref)"
  enc="$(mac_urlencode_path "${rel}")"
  printf '%s\n' \
    "https://ghfast.top/https://raw.githubusercontent.com/${GITHUB_REPO}/${ref}/${enc}" \
    "https://gh-proxy.com/https://raw.githubusercontent.com/${GITHUB_REPO}/${ref}/${enc}" \
    "https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@${ref}/${enc}" \
    "https://raw.gitmirror.com/${GITHUB_REPO}/${ref}/${enc}" \
    "https://raw.githubusercontent.com/${GITHUB_REPO}/${ref}/${enc}"
}

# Return 0 if dest looks like a real source file, not an HTML/404 body.
mac_file_looks_ok() {
  local dest="$1"
  local first
  if [ ! -s "${dest}" ]; then
    return 1
  fi
  first="$(head -c 80 "${dest}" 2>/dev/null || true)"
  case "${first}" in
    *'<html'*|*'<HTML'*|*'404: Not Found'*|*'404 Not Found'*)
      return 1
      ;;
  esac
  return 0
}

download_url_list_to() {
  local dest="$1"
  local url tmp
  tmp="${dest}.tmp.$$"
  mkdir -p "$(dirname "${dest}")"
  while IFS= read -r url; do
    [ -z "${url}" ] && continue
    if curl -g -fsSL --connect-timeout 8 --max-time 30 --retry 2 --retry-delay 2 "${url}" -o "${tmp}"; then
      if mac_file_looks_ok "${tmp}"; then
        mv "${tmp}" "${dest}"
        return 0
      fi
    fi
    rm -f "${tmp}"
  done
  rm -f "${tmp}"
  return 1
}

download_repo_file() {
  local root="$1"
  local rel="$2"
  local dest="${root}/${rel}"
  if download_url_list_to "${dest}" < <(mac_raw_urls "${rel}"); then
    echo "  -> ${rel}"
    return 0
  fi
  echo "  !! download failed: ${rel}" >&2
  return 1
}

# Files required for mobile dev after a partial git pull / mirror sync.
# Keep this list complete: missing imports cause Metro 500.
mac_mobile_sync_files() {
  cat <<'EOF'
package.json
pnpm-workspace.yaml
apps/mobile/metro.config.js
apps/mobile/package.json
apps/mobile/app.json
apps/mobile/babel.config.js
apps/mobile/tsconfig.json
apps/mobile/.env.staging.example
apps/mobile/app/_layout.tsx
apps/mobile/app/index.tsx
apps/mobile/app/onboarding.tsx
apps/mobile/app/private.tsx
apps/mobile/app/table.tsx
apps/mobile/app/settings.tsx
apps/mobile/app/profile.tsx
apps/mobile/app/leaderboard.tsx
apps/mobile/app/shop.tsx
apps/mobile/app/room/[code].tsx
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
apps/mobile/src/types/table.ts
apps/mobile/src/components/Table9Max.tsx
apps/mobile/src/components/ChipFlyLayer.tsx
apps/mobile/src/components/PrivateTablePanels.tsx
apps/mobile/src/components/ShowdownOverlay.tsx
apps/mobile/src/components/PotDisplay.tsx
apps/mobile/src/components/ActionPanel.tsx
apps/mobile/src/components/HandStatusBar.tsx
apps/mobile/src/components/CommunityCardsRow.tsx
apps/mobile/src/components/TurnTimer.tsx
apps/mobile/src/components/Avatar.tsx
apps/mobile/src/components/EmojiBar.tsx
apps/mobile/src/components/ui/GameModal.tsx
apps/mobile/src/components/ui/Button.tsx
apps/mobile/src/components/ui/Screen.tsx
apps/mobile/src/components/ui/PlayingCard.tsx
apps/mobile/src/components/ui/Card.tsx
apps/mobile/src/components/auth/AuthField.tsx
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
scripts/mac-start-mobile.sh
scripts/mac-mobile-dev.sh
scripts/mac-sync-mobile.sh
scripts/mac-diagnose.sh
EOF
}

sync_mobile_from_mirror() {
  local root="$1"
  local rel failed=0
  echo "==> Sync mobile + shared from mirror  [${MAC_COMMON_REV}]"
  echo "    Root: ${root}"
  echo "    Ref:  $(mac_git_ref)"
  while IFS= read -r rel; do
    [ -z "${rel}" ] && continue
    if ! download_repo_file "${root}" "${rel}"; then
      if [ -f "${root}/${rel}" ]; then
        echo "    keep local ${rel}"
        continue
      fi
      case "${rel}" in
        scripts/*|apps/mobile/app/room/*)
          echo "    skip optional ${rel}"
          ;;
        *)
          failed=1
          ;;
      esac
    fi
  done < <(mac_mobile_sync_files)
  if [ "${failed}" -ne 0 ]; then
    echo "ERROR: 部分客户端文件同步失败。可稍后重试；镜像对新文件可能有几十秒缓存延迟。" >&2
    return 1
  fi
}

verify_mobile_index() {
  local root="$1"
  if grep -q "router.replace('/auth/login')" "${root}/apps/mobile/app/index.tsx" 2>/dev/null; then
    echo "ERROR: apps/mobile/app/index.tsx 仍是旧版本（大厅里直接 replace 登录）。" >&2
    return 1
  fi
  if [ ! -f "${root}/packages/shared/dist/index.js" ]; then
    echo "ERROR: packages/shared/dist 不存在 — shared 没有 build 成功？" >&2
    return 1
  fi
  local missing=0 rel
  for rel in \
    apps/mobile/src/components/ActionPanel.tsx \
    apps/mobile/src/components/auth/AuthField.tsx \
    apps/mobile/src/components/ui/Card.tsx \
    apps/mobile/src/components/ui/PlayingCard.tsx
  do
    if [ ! -f "${root}/${rel}" ]; then
      echo "ERROR: 缺少 ${rel}（旧同步清单漏文件会导致 Metro 500）" >&2
      missing=1
    fi
  done
  if [ "${missing}" -ne 0 ]; then
    return 1
  fi
  echo "==> Mobile sources OK"
}

print_mac_start_banner() {
  echo "==> mac-common ${MAC_COMMON_REV}"
  echo "==> node $(node -v 2>/dev/null || echo missing)  pnpm $(pnpm -v 2>/dev/null || echo missing)"
}

# Locate this library when the entry script may live in /tmp or scripts/.
mac_find_lib() {
  local script_path="${1:-$0}"
  local script_dir root tmp

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

  tmp="/tmp/mac-common-$$.sh"
  if download_url_list_to "${tmp}" < <(mac_raw_urls "scripts/lib/mac-common.sh"); then
    printf '%s\n' "${tmp}"
    return 0
  fi

  echo "ERROR: cannot load scripts/lib/mac-common.sh" >&2
  return 1
}
