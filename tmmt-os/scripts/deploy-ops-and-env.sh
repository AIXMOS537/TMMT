#!/usr/bin/env bash
# Deploy TMMT OS as Vercel project tmmt-ops + print env checklist.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE="${NODE:-/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node}"
if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel   (or: npx vercel)"
  echo "Then re-run this script."
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo "Run: vercel env pull .env.local"
  exit 1
fi

GHL_SECRET="${GHL_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"
SYNC_SECRET="${SYNC_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"

echo "=== Add these in Vercel (tmmt-ops project) if missing ==="
echo "GHL_WEBHOOK_SECRET=$GHL_SECRET"
echo "SYNC_WEBHOOK_SECRET=$SYNC_SECRET"
echo "NEXT_PUBLIC_PORTAL_URL=https://tmmt-c919-two.vercel.app"
echo "NEXT_PUBLIC_OPS_URL=https://tmmt-ops.vercel.app"
echo ""
echo "Also: NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY (from .env.local)"
echo ""

read -r -p "Link/create Vercel project tmmt-ops now? [y/N] " yn
if [[ "${yn,,}" == "y" ]]; then
  vercel link
fi

read -r -p "Production deploy now? [y/N] " dp
if [[ "${dp,,}" == "y" ]]; then
  vercel --prod
fi

echo ""
echo "Smoke test:"
echo "  export GHL_WEBHOOK_SECRET='$GHL_SECRET'"
echo "  BASE_URL=https://tmmt-ops.vercel.app ./scripts/smoke-crm-sync.sh"
echo ""
echo "GHL setup: TMMT MANAGEMENT/INTEGRATIONS/GHL_WEBHOOK_SETUP.md"
