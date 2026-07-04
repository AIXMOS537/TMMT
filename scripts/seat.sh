#!/usr/bin/env bash
# seat — ONE SHOT operator-seat provisioning. Handles the whole flow:
#   1. ensures SUPABASE_SERVICE_ROLE_KEY is present (prompts once, hidden, persists + locks)
#   2. optionally syncs that key to Vercel so future env-pulls are complete
#   3. dry-run (shows the plan, writes nothing)
#   4. confirm → apply (creates the seat, prints one-time credentials)
#
#   bash scripts/seat.sh                                   # defaults: Moe Legacy / Umar / graduate (the King)
#   bash scripts/seat.sh <vertical> <email> [stage] [name]
#
# Stages: learn | earn | admin | graduate     (graduate = sovereign owner, 85%)
# Note: customer-facing it's Credit GUIDANCE, never "repair" (compliance).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ok(){   printf '  \033[32m✓\033[0m %s\n' "$*"; }
info(){ printf '  \033[34m›\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
die(){  printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Seat identity comes from args — no personal defaults baked into the repo.
VERTICAL="${1:-moe-legacy}"
EMAIL="${2:?seat email required, e.g. bash seat.sh moe-legacy founder@example.com}"
STAGE="${3:-graduate}"
NAME="${4:-New Seat}"

cat <<B

   ╔══════════════════════════════════════════════╗
   ║  TMMT · ONE SHOT — OPERATOR SEAT  👑          ║
   ╚══════════════════════════════════════════════╝
   vertical : $VERTICAL
   email    : $EMAIL
   stage    : $STAGE
   name     : $NAME

B

# --- 1. Ensure the privileged Supabase key is present ----------------------
key_present() {
  for f in .env.local .env; do
    [ -f "$f" ] || continue
    local v; v="$(grep -h "^SUPABASE_SERVICE_ROLE_KEY=" "$f" 2>/dev/null | head -1 | cut -d= -f2-)"
    [ -n "$v" ] && return 0
  done
  return 1
}

if key_present; then
  ok "SUPABASE_SERVICE_ROLE_KEY already present"
else
  warn "SUPABASE_SERVICE_ROLE_KEY is missing (Vercel can't pull sensitive secrets)."
  echo
  echo "  Get it: Supabase Dashboard → your project → Project Settings → API Keys"
  echo "          → copy the 'secret' key (sb_secret_…)   [or legacy 'service_role' JWT]"
  echo
  # Hidden input — the key is never echoed to the screen or shell history.
  printf "  Paste the key here (input hidden), then Enter: "
  read -rs SR_KEY; echo
  [ -n "$SR_KEY" ] || die "no key entered — re-run when you have it."
  case "$SR_KEY" in
    sb_secret_*|eyJ*|sb_*) : ;;  # looks like a secret/JWT
    *) warn "that doesn't look like a Supabase secret key — continuing anyway";;
  esac
  # Persist into .env.local: strip any empty placeholder line, append the real one.
  touch .env.local
  grep -v "^SUPABASE_SERVICE_ROLE_KEY=" .env.local > .env.local.tmp 2>/dev/null || true
  mv .env.local.tmp .env.local
  printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$SR_KEY" >> .env.local
  chmod 600 .env.local
  ok "key saved to .env.local (locked 600)"

  # 2. Best-effort: push to Vercel so the NEXT machine pulls a complete .env.
  if command -v vercel >/dev/null 2>&1; then
    info "syncing key to Vercel (so future env-pulls are complete)…"
    # Remove any existing var first (ignore errors), then add fresh.
    yes | vercel env rm SUPABASE_SERVICE_ROLE_KEY production >/dev/null 2>&1 || true
    if printf '%s' "$SR_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production >/dev/null 2>&1; then
      ok "synced to Vercel (production)"
    else
      warn "Vercel sync skipped — add it manually later if you want: vercel env add SUPABASE_SERVICE_ROLE_KEY production"
    fi
  fi
  unset SR_KEY
fi

# --- 3. Dry-run -------------------------------------------------------------
echo
info "DRY RUN — showing the plan, writing nothing…"
echo
if ! node scripts/provision-tenant-seat.mjs \
      --vertical "$VERTICAL" --email "$EMAIL" --stage "$STAGE" --name "$NAME" --dry-run; then
  die "dry-run failed — read the error above. (If 'No org matching' → the org row needs creating first; tell me.)"
fi

# --- 4. Confirm → apply -----------------------------------------------------
echo
printf "  \033[1mApply for real and create the seat? [y/N]\033[0m "
read -r yn
case "$yn" in
  y|Y|yes|YES)
    echo
    info "APPLYING — creating auth user + org role + operator profile…"
    echo
    node scripts/provision-tenant-seat.mjs \
      --vertical "$VERTICAL" --email "$EMAIL" --stage "$STAGE" --name "$NAME" --apply
    echo
    ok "Done. Send the one-time password above to Umar SECURELY (text/Signal — not email,"
    echo "     since the email account IS the login). Have him reset on first sign-in. 👑"
    ;;
  *)
    echo
    info "Stopped — nothing written. Re-run when ready: bash scripts/seat.sh"
    ;;
esac
