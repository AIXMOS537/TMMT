#!/usr/bin/env bash
# backfill-schema.sh - the macOS/Linux half of scripts/backfill-schema.ps1.
# Pulls the authoritative schema out of the live database so this repo can
# rebuild it. Your password is read with `read -s`, never echoed or stored.
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-uapxakmlwnpfsftfeezx}"
POOLER_HOST="${POOLER_HOST:-aws-1-us-west-2.pooler.supabase.com}"
POOLER_PORT="${POOLER_PORT:-5432}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/supabase/schema"
STAMP="$(date +%Y-%m-%d)"
mkdir -p "$OUT_DIR"

echo
echo "  BACKFILL CANON FROM LIVE"
echo "  ------------------------"
echo "  project   $PROJECT_REF"
echo "  output    $OUT_DIR"
echo

printf '  Database password (input hidden): '
read -rs DB_PASS
echo
[ -z "$DB_PASS" ] && { echo "  [FAIL] no password given - nothing done."; exit 1; }

# Percent-encode: a '#', '@' or '/' in the password truncates the URL otherwise.
ESCAPED="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$DB_PASS")"
DB_URL="postgresql://postgres.${PROJECT_REF}:${ESCAPED}@${POOLER_HOST}:${POOLER_PORT}/postgres"
unset DB_PASS

cleanup() { unset ESCAPED DB_URL 2>/dev/null || true; }
trap cleanup EXIT

echo "  DUMPING SCHEMA (public only - auth/storage/realtime belong to the platform)"
npx --yes supabase@2.116.0 db dump --db-url "$DB_URL" --schema public -f "$OUT_DIR/live-baseline-$STAMP.sql"
echo "  [ OK ] schema  -> $OUT_DIR/live-baseline-$STAMP.sql"

echo "  DUMPING ROLES AND GRANTS"
if npx --yes supabase@2.116.0 db dump --db-url "$DB_URL" --role-only -f "$OUT_DIR/live-roles-$STAMP.sql"; then
  echo "  [ OK ] roles   -> $OUT_DIR/live-roles-$STAMP.sql"
else
  echo "  [warn] role dump failed (non-fatal) - the schema dump is still good."
fi

cat <<'NEXT'

  NEXT
  ----
  1. Read the diff before you commit it - this is the whole schema.
  2. git add supabase/schema && git commit   (owner gate: no blind push)
  3. Re-run after any migration lands live, so canon never drifts again.

  To make this the migration baseline instead of a reference dump:
    supabase migration new baseline   # then paste the dump in
    supabase migration repair --status applied <that version>
NEXT
