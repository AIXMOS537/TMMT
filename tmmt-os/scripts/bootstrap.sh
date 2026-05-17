#!/usr/bin/env bash
# First-run bootstrap for TMMT OS (local)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking .env.local"
if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "Created .env.local — fill Supabase keys before continuing."
  exit 1
fi

echo "==> Installing dependencies"
if command -v npm >/dev/null 2>&1; then
  npm install
else
  echo "npm not found. Install Node.js or use portable node, then: npm install"
fi

echo "==> Checking database schema"
if command -v node >/dev/null 2>&1; then
  node scripts/check-db.mjs || true
else
  echo "node not found — skip schema check"
fi

echo ""
echo "Next steps:"
echo "  1. Apply migration: open SQL Editor and run supabase/migrations/0001_init.sql"
echo "     https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/sql/new"
echo "  2. npm run dev  →  http://localhost:3000/login (sign up)"
echo "  3. Promote admin: update public.profiles set role = 'admin' where email = 'you@tmmt.com';"
echo "  4. Test intake: http://localhost:3000/intake"
