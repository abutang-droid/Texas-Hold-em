#!/usr/bin/env bash
# Enable Caribbean Stud on the HOME SERVER (Linux). Do not run on the Mac mini.
#
#   ssh uoto@192.168.31.4
#   curl -fsSL "https://ghfast.top/https://raw.githubusercontent.com/abutang-droid/Texas-Hold-em/cursor/home-server-ip-9b0a/scripts/staging-enable-stud.sh" -o /tmp/enable-stud.sh
#   bash /tmp/enable-stud.sh
set -euo pipefail

if [ "$(uname -s)" = "Darwin" ]; then
  echo "ERROR: 这是家庭服务器脚本，不能在 Mac 上跑。" >&2
  echo "       先执行: ssh uoto@192.168.31.4" >&2
  exit 1
fi

REPO_SLUG="abutang-droid/Texas-Hold-em"
BRANCH="${STUD_GIT_REF:-cursor/home-server-ip-9b0a}"
API_P="${API_PORT:-3000}"

resolve_root() {
  if [ -n "${TH_REPO_ROOT:-}" ] && [ -f "${TH_REPO_ROOT}/apps/api/src/main.ts" ]; then
    (cd "${TH_REPO_ROOT}" && pwd)
    return 0
  fi
  if [ -f "${PWD}/apps/api/src/main.ts" ]; then
    (cd "${PWD}" && pwd)
    return 0
  fi
  if [ -f "${HOME}/Texas-Hold-em/apps/api/src/main.ts" ]; then
    (cd "${HOME}/Texas-Hold-em" && pwd)
    return 0
  fi
  echo "ERROR: 找不到 Texas-Hold-em 仓库（需要 apps/api/src/main.ts）。" >&2
  echo "       试一下: cd ~/Texas-Hold-em && bash /tmp/enable-stud.sh" >&2
  return 1
}

download_raw() {
  local rel="$1"
  local dest="$2"
  local stamp
  stamp="$(date +%s)"
  local url
  for url in \
    "https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}/${rel}?t=${stamp}" \
    "https://ghfast.top/https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}/${rel}" \
    "https://raw.gitmirror.com/${REPO_SLUG}/${BRANCH}/${rel}"
  do
    if curl -fsSL --globoff --retry 2 --connect-timeout 20 -o "${dest}.tmp" "$url"; then
      mv "${dest}.tmp" "${dest}"
      return 0
    fi
    rm -f "${dest}.tmp"
  done
  return 1
}

ROOT="$(resolve_root)"
cd "${ROOT}"
echo "==> Repo: ${ROOT}"
echo "==> Branch: ${BRANCH}"

if [ -f .env ]; then
  if grep -q '192.168.31.53' .env; then
    echo "==> Rewriting retired 192.168.31.53 → 192.168.31.4 in .env"
    sed -i.bak 's/192\.168\.31\.53/192.168.31.4/g' .env
    rm -f .env.bak
  fi
fi

echo "==> Fetching latest update script"
mkdir -p scripts
download_raw scripts/staging-update-no-git.sh scripts/staging-update-no-git.sh || true
chmod +x scripts/staging-update-no-git.sh

if [ -x scripts/staging-update-no-git.sh ]; then
  echo "==> Deploying ${BRANCH} (API 0.7.0 + Room)"
  EXPECTED_ROOM_VERSION="${EXPECTED_ROOM_VERSION:-0.6.0}" \
    EXPECTED_API_VERSION="${EXPECTED_API_VERSION:-0.7.0}" \
    bash scripts/staging-update-no-git.sh "${BRANCH}"
else
  echo "WARN: could not refresh staging-update-no-git.sh — building current tree" >&2
  pnpm install
  pnpm build
  pm2 startOrRestart infra/staging/ecosystem.config.cjs --update-env
  pm2 save
fi

echo "==> Migration 007 (stud_hands)"
MIG007="infra/migrations/007_caribbean_stud.sql"
if [ ! -f "${MIG007}" ]; then
  mkdir -p infra/migrations
  download_raw infra/migrations/007_caribbean_stud.sql "${MIG007}"
fi
if [ ! -f "${MIG007}" ]; then
  echo "ERROR: missing ${MIG007}" >&2
  exit 1
fi

applied=0
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx th-postgres; then
  if docker exec -i th-postgres psql -U th -d texas_holdem -v ON_ERROR_STOP=1 < "${MIG007}"; then
    applied=1
  fi
fi
if [ "${applied}" -ne 1 ] && [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${POSTGRES_PASSWORD:-th_pass}" psql \
      -h "${POSTGRES_HOST:-localhost}" \
      -p "${POSTGRES_PORT:-5432}" \
      -U "${POSTGRES_USER:-th}" \
      -d "${POSTGRES_DATABASE:-texas_holdem}" \
      -v ON_ERROR_STOP=1 \
      -f "${MIG007}"
    applied=1
  fi
fi
if [ "${applied}" -ne 1 ]; then
  echo "ERROR: 无法执行 007。确认 Docker 容器 th-postgres 在跑: docker compose ps" >&2
  exit 1
fi

echo "==> Restart API so it sees the new table"
pm2 startOrRestart infra/staging/ecosystem.config.cjs --only th-api --update-env
pm2 save
sleep 2

HEALTH="$(curl -sf --connect-timeout 5 "http://127.0.0.1:${API_P}/health" || true)"
STUD="$(curl -sf --connect-timeout 5 "http://127.0.0.1:${API_P}/api/v1/stud/config" || true)"
echo "health: ${HEALTH:-FAIL}"
echo "stud:   ${STUD:-FAIL}"

if ! echo "${HEALTH}" | grep -q '"version":"0.7.0"'; then
  echo "ERROR: API 还不是 0.7.0。看: pm2 logs th-api --lines 40 --nostream" >&2
  exit 1
fi
if ! echo "${STUD}" | grep -q 'CARIBBEAN_STUD'; then
  echo "ERROR: /api/v1/stud/config 没有人庄配置。" >&2
  exit 1
fi

echo ""
echo "人庄服务已就绪。回 Mac 硬刷新大厅后再进「人庄模式」。"
echo "  curl -s http://192.168.31.4:3000/health"
echo "  curl -s http://192.168.31.4:3000/api/v1/stud/config"
