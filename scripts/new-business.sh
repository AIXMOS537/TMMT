#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# new-business.sh — the mass-production engine. ONE command stands up a brand-new
# business/vertical from the verified codebase: its own deployable bundle, its own
# branded portal, its own env scaffold, and a tailored launch checklist.
# ───────────────────────────────────────────────────────────────────────────
#   bash scripts/new-business.sh "Acme Credit" --portal acme --agency moe
#   bash scripts/new-business.sh "X Rentals"   --agency x
# Flags: --portal <id>  --agency x|moe  --out <dir>
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
G(){ printf "\033[32m%s\033[0m\n" "$1"; }
die(){ printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

NAME="${1:-}"; shift || true
[ -n "$NAME" ] || die 'usage: new-business.sh "Business Name" [--portal id] [--agency x|moe]'
PORTAL=""; AGENCY="x"; OUT=""
while [ $# -gt 0 ]; do case "$1" in
  --portal) PORTAL="${2:?}"; shift 2;;
  --agency) AGENCY="${2:?}"; shift 2;;
  --out) OUT="${2:?}"; shift 2;;
  *) die "unknown arg: $1";;
esac; done

SLUG="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
[ -n "$PORTAL" ] || PORTAL="$SLUG"
ROOT="$(git rev-parse --show-toplevel)"
[ -n "$OUT" ] || OUT="$(dirname "$ROOT")/business-$SLUG"
[ -e "$OUT" ] && die "Target exists: $OUT (remove it or pass --out)"

B "== Launching new business: $NAME =="
echo "  slug:$SLUG  portal:$PORTAL  agency:$AGENCY  out:$OUT"
echo

# 1) build the deployable, backend-less bundle from the verified codebase
B "1/3  Building deployable bundle (backend-less, brain-gated)…"
OUT="$OUT" bash "$ROOT/scripts/build-projectaixmos-legacy.sh" --apply --git >/dev/null 2>&1 \
  || die "bundle build failed — run scripts/build-projectaixmos-legacy.sh --apply to see why"
G "bundle ready: $OUT"

# 2) scaffold its .env (its own GHL agency keys + its branded portal)
B "2/3  Scaffolding env (its own tenant)…"
if [ -f "$OUT/.env.legacy.example" ]; then
  sed "s/^NEXT_PUBLIC_PORTAL=.*/NEXT_PUBLIC_PORTAL=$PORTAL/" "$OUT/.env.legacy.example" > "$OUT/.env"
  grep -q "NEXT_PUBLIC_PORTAL" "$OUT/.env" || printf 'NEXT_PUBLIC_PORTAL=%s\n' "$PORTAL" >> "$OUT/.env"
  G ".env scaffolded (portal=$PORTAL) — fill in THIS business's own keys"
fi

# 3) tailored launch checklist
cat > "$OUT/LAUNCH.md" <<EOF
# Launch — $NAME

Its own isolated tenant under the **$AGENCY** GoHighLevel agency. Serves any client,
plugs into the empire, can't destabilize any other business.

## Provision (its own accounts — ~30 min)
1. **Portal brand:** add a \`$PORTAL\` entry to src/lib/portal-config.ts (name, color).
   (docs/PORTAL-SIGNIN.md) — already set as NEXT_PUBLIC_PORTAL=$PORTAL in .env.
2. **Supabase:** new project → run supabase/migrations/* → confirm RLS on.
   Put its URL + anon + service_role in .env.
3. **GoHighLevel ($AGENCY agency):** new sub-account/location → set GHL_API_KEY,
   GHL_LOCATION_ID, GHL_WEBHOOK_SECRET in .env. (docs/GHL-MULTI-AGENCY.md)
4. **Vercel:** import this folder → set env from .env → deploy.
5. **Smoke test:** /login shows "$NAME" brand · a lead flows in → served. Done.

AI brain stays OFF until licensed (AIXMOS_BRAIN_URL blank). Everything else works.
EOF
G "launch checklist: $OUT/LAUNCH.md"

echo
B "✅ $NAME is scaffolded. To go live: cd \"$OUT\" → follow LAUNCH.md (provision + deploy)."
echo "   Repeat this command for every new business. That's the mass-production line. 👑"
