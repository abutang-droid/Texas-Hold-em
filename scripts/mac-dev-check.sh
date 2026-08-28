#!/usr/bin/env bash
# Mac mini 首次环境检查（不安装服务器组件）
set -euo pipefail

echo "=== Mac mini 开发环境检查 ==="

check() {
  if command -v "$1" >/dev/null; then
    echo "✓ $1  $($1 --version 2>/dev/null | head -1 || $1 -v 2>/dev/null | head -1)"
  else
    echo "✗ $1  未安装"
    return 1
  fi
}

fail=0
check node || fail=1
check pnpm || fail=1
check git || fail=1
check curl || fail=1

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "${NODE_MAJOR:-0}" != "20" ]; then
  echo "⚠ 建议 Node 20 LTS（当前 $(node -v)）。安装: brew install node@20"
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "安装缺失项:"
  echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  echo "  brew install node@20 git"
  echo "  npm install -g pnpm@10"
  exit 1
fi

echo "环境 OK"
echo ""
echo "下一步:"
echo "  git clone https://github.com/abutang-droid/Texas-Hold-em.git ~/Texas-Hold-em"
echo "  cd ~/Texas-Hold-em && git checkout cursor/phase4-open-beta-2fc9"
echo "  bash scripts/mac-staging-check.sh      # 检查 192.168.31.53"
echo "  bash scripts/mac-staging-mobile.sh     # 启动游戏客户端"
