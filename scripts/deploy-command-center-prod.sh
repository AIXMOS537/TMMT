#!/usr/bin/env bash
# Production deploy with Supabase env baked in (works even before Vercel dashboard vars exist).
#
#   bash scripts/deploy-command-center-prod.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS="$ROOT/tmmt-os"

if [[ ! -f "$OPS/.env.local" ]]; then
  echo "ERROR: Missing $OPS/.env.local"
  exit 1
fi

grep '^NEXT_PUBLIC_SUPABASE' "$OPS/.env.local" >"$ROOT/.env.production.local"

echo "→ vercel build --prod"
cd "$ROOT"
npx vercel build --prod --yes

echo "→ vercel deploy --prebuilt --prod"
npx vercel deploy --prebuilt --prod --yes

echo ""
echo "Production: https://tmmt-command-center.vercel.app"
