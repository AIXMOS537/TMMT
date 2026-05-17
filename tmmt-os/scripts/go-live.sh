#!/usr/bin/env bash
# Run from: AIX_Command_Center/TMMT MANAGEMENT/tmmt-os (deployable copy)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1. Local build check ==="
if command -v npm >/dev/null 2>&1; then
  npm run build
else
  NODE="${NODE:-/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node}"
  "$NODE" ./node_modules/next/dist/bin/next build
fi
echo "Build OK."

echo ""
echo "=== 2. Vercel (interactive — browser login) ==="
if [[ ! -d .vercel ]]; then
  echo "  vercel login"
  echo "  vercel link    # project name: tmmt-ops"
fi
echo "  vercel env pull .env.local"
echo "  vercel --prod"

echo ""
echo "=== 3. Verify ==="
echo "  curl -sS https://tmmt-ops.vercel.app/api/status"

echo ""
echo "=== 4. Supabase ==="
echo "  Run: supabase/migrations/RUN_0002_0003_IN_SQL_EDITOR.sql in SQL Editor"
