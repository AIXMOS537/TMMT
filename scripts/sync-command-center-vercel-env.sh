#!/usr/bin/env bash
# Push NEXT_PUBLIC_SUPABASE_* to Vercel (command-center + tmmt-ops).
# Sources (first match wins): tmmt-os/.env.local → .env.production.local → tmmt-ops production pull
#
#   bash scripts/sync-command-center-vercel-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS="$ROOT/tmmt-os"
TMP="$(mktemp)"

cleanup() { rm -f "$TMP" "$TMP.pair"; }
trap cleanup EXIT

read_env_pair() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local u k
  u=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$file" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  k=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$file" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [[ -n "$u" && -n "$k" ]] || return 1
  printf '%s\n%s\n' "$u" "$k"
}

echo "→ Resolving Supabase public keys…"
SOURCE=""
if read_env_pair "$OPS/.env.local" >"$TMP.pair" 2>/dev/null; then
  SOURCE="$OPS/.env.local"
elif read_env_pair "$ROOT/.env.production.local" >"$TMP.pair" 2>/dev/null; then
  SOURCE="$ROOT/.env.production.local"
else
  echo "   (trying tmmt-ops Vercel production pull…)"
  (cd "$OPS" && npx vercel env pull "$TMP" --environment=production --yes 2>/dev/null) || true
  if read_env_pair "$TMP" >"$TMP.pair" 2>/dev/null; then
    SOURCE="tmmt-ops (Vercel production)"
  fi
fi

if [[ ! -s "$TMP.pair" ]]; then
  echo ""
  echo "ERROR: Could not find non-empty NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  echo "  Add them to: $OPS/.env.local"
  echo "  Or set them on Vercel: tmmt-ops → Settings → Environment Variables → Production"
  exit 1
fi

URL=$(sed -n '1p' "$TMP.pair")
KEY=$(sed -n '2p' "$TMP.pair")
echo "   Using: $SOURCE"

push_env() {
  local project_dir="$1"
  local project_name="$2"
  echo ""
  echo "→ $project_name"
  if ! (cd "$project_dir" && \
    for target in production preview development; do
      echo "   $target …"
      npx vercel env add NEXT_PUBLIC_SUPABASE_URL "$target" --value "$URL" -y 2>/dev/null \
        || { npx vercel env rm NEXT_PUBLIC_SUPABASE_URL "$target" -y 2>/dev/null || true
             npx vercel env add NEXT_PUBLIC_SUPABASE_URL "$target" --value "$URL" -y; }
      npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$target" --value "$KEY" -y 2>/dev/null \
        || { npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY "$target" -y 2>/dev/null || true
             npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$target" --value "$KEY" -y; }
    done
    npx vercel env ls production 2>&1 | grep NEXT_PUBLIC_SUPABASE || true); then
    echo "   WARN: Vercel CLI timed out or failed for $project_name."
    echo "   Paste keys manually: bash scripts/print-supabase-env-for-vercel.sh"
    return 1
  fi
}

push_env "$ROOT" "tmmt-command-center"
push_env "$OPS" "tmmt-ops"

# Keep local command-center env file in sync for prebuilt builds
{
  grep -v '^NEXT_PUBLIC_SUPABASE' "$ROOT/.env.cmdc.prod" 2>/dev/null || true
  echo "NEXT_PUBLIC_SUPABASE_URL=$URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$KEY"
} >"$ROOT/.env.cmdc.prod.tmp"
mv "$ROOT/.env.cmdc.prod.tmp" "$ROOT/.env.cmdc.prod"

echo ""
echo "Done. Deploy command center:"
echo "  bash scripts/deploy-command-center-prod.sh"
