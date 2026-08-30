#!/usr/bin/env bash
# Print Mac Expo diagnostics to paste back to the agent.
set -euo pipefail

echo "=== mac-diagnose $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "uname: $(uname -a 2>/dev/null || true)"
echo "pwd:   ${PWD}"
echo "HOME:  ${HOME}"
echo "node:  $(command -v node 2>/dev/null || echo missing) $(node -v 2>/dev/null || true)"
echo "pnpm:  $(command -v pnpm 2>/dev/null || echo missing) $(pnpm -v 2>/dev/null || true)"
echo "npx:   $(command -v npx 2>/dev/null || echo missing)"
echo "curl:  $(command -v curl 2>/dev/null || echo missing)"
echo ""

echo "--- port 8081 ---"
if command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP:8081 -sTCP:LISTEN || echo "(nothing listening)"
else
  echo "lsof not available"
fi

echo ""
echo "--- repo ---"
if [ -f apps/mobile/app/index.tsx ]; then
  echo "index.tsx: present"
  grep -n "LAYOUT_REV\|router.replace" apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx 2>/dev/null | head -20 || true
else
  echo "apps/mobile/app/index.tsx MISSING (cd ~/Texas-Hold-em first)"
fi

echo ""
echo "--- shared dist ---"
ls -l packages/shared/dist/index.js 2>/dev/null || echo "packages/shared/dist/index.js MISSING"

echo ""
echo "--- expo bin ---"
ls -l node_modules/.bin/expo apps/mobile/node_modules/.bin/expo 2>/dev/null || echo "expo binary MISSING"

echo ""
echo "--- .env ---"
if [ -f apps/mobile/.env ]; then
  grep -E 'EXPO_PUBLIC_(API|ROOM)_URL' apps/mobile/.env || true
else
  echo "apps/mobile/.env MISSING"
fi

echo ""
echo "--- key files ---"
for f in \
  apps/mobile/src/components/ActionPanel.tsx \
  apps/mobile/src/components/auth/AuthField.tsx \
  apps/mobile/src/components/ui/Card.tsx \
  "apps/mobile/app/room/[code].tsx" \
  scripts/lib/mac-common.sh \
  scripts/mac-start-mobile.sh
do
  if [ -f "$f" ]; then
    echo "OK   $f"
  else
    echo "MISS $f"
  fi
done

echo ""
echo "=== end mac-diagnose ==="
