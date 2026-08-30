#!/usr/bin/env bash
# Resolve monorepo root when script may live in /tmp (curl download) or scripts/.
resolve_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${1:-$0}")" && pwd)"

  if [ -n "${TH_REPO_ROOT:-}" ] && [ -f "${TH_REPO_ROOT}/apps/mobile/app/index.tsx" ]; then
    (cd "${TH_REPO_ROOT}" && pwd)
    return 0
  fi
  if [ -f "${PWD}/apps/mobile/app/index.tsx" ]; then
    (cd "${PWD}" && pwd)
    return 0
  fi
  if [ -f "${script_dir}/../apps/mobile/app/index.tsx" ]; then
    (cd "${script_dir}/.." && pwd)
    return 0
  fi
  if [ -f "${HOME}/Texas-Hold-em/apps/mobile/app/index.tsx" ]; then
    (cd "${HOME}/Texas-Hold-em" && pwd)
    return 0
  fi
  echo "ERROR: cannot find repo root (need apps/mobile/app/index.tsx)." >&2
  echo "  cd ~/Texas-Hold-em   OR   TH_REPO_ROOT=~/Texas-Hold-em bash $0" >&2
  return 1
}
