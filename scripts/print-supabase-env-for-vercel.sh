#!/usr/bin/env bash
# Print Supabase public keys for manual paste into Vercel dashboard (when CLI hangs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="${ROOT}/tmmt-os/.env.local"
[[ -f "$ENV" ]] || { echo "Missing $ENV"; exit 1; }
echo "Copy these into Vercel → Settings → Environment Variables"
echo "(Production + Preview + Development) for BOTH projects:"
echo "  - tmmt-command-center"
echo "  - tmmt-ops"
echo ""
grep '^NEXT_PUBLIC_SUPABASE' "$ENV"
