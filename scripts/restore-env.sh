#!/usr/bin/env bash
# restore-env — pull .env from Vercel (source of truth) onto this machine.
# Run once after cloning or after the flashdrive path is retired.
#
#   bash scripts/restore-env.sh
#
# Requires: vercel CLI (installed via npm i -g vercel). Login happens interactively.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ok(){ printf '  \033[32m✓\033[0m %s\n' "$*"; }
info(){ printf '  › %s\n' "$*"; }
die(){ printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

echo
echo "  ╔══════════════════════════════════════╗"
echo "  ║  TMMT — restore .env from Vercel      ║"
echo "  ╚══════════════════════════════════════╝"
echo

# 1. Vercel CLI present?
if ! command -v vercel >/dev/null 2>&1; then
  info "vercel CLI not found — installing…"
  npm i -g vercel || die "npm install vercel failed"
fi
ok "vercel CLI ready ($(vercel --version 2>/dev/null | head -1))"

# 2. Logged in?
if ! vercel whoami >/dev/null 2>&1; then
  info "not logged in — opening browser for auth…"
  vercel login || die "vercel login failed"
fi
ok "logged in as $(vercel whoami 2>/dev/null)"

# 3. Linked?
cd "$ROOT"
if ! vercel inspect >/dev/null 2>&1; then
  info "project not linked — linking now…"
  vercel link --yes || die "vercel link failed — run manually: vercel link"
fi
ok "project linked"

# 4. Pull env.
info "pulling .env (production)…"
vercel env pull .env --environment=production --yes 2>/dev/null \
  || vercel env pull .env --environment=production \
  || die "vercel env pull failed"
ok ".env restored"

# 5. Quick sanity check.
echo
echo "  Verifying keys present…"
for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if grep -q "^${key}=" .env 2>/dev/null; then
    ok "$key ✓"
  else
    printf '  \033[33m!\033[0m %s — missing from pulled env\n' "$key" >&2
  fi
done

echo
ok "Done — run 'bash scripts/swarm-doctor.sh' to confirm 0 warnings."
echo "   Then: bash scripts/hailmary booyah"
echo
