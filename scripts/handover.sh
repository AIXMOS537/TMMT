#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# handover.sh — NO car leaves your hands until you're protected. The pre-ship
# gate for the 1-car partnership: it refuses to say GO until all four hold:
#   ① licensed dealer (on the grant)  ② insurance proof + YOU as loss-payee
#   ③ paid upfront                     ④ title stays in your name
# This closes the one gap code can't auto-do: the insurance binding. The gate
# makes you confirm it before keys change hands — so you never hand a car to a
# handshake again.
# ───────────────────────────────────────────────────────────────────────────
#   bash scripts/handover.sh <partner-name> --vin <VIN> \
#        --insurance --losspayee --paid          # flags = "this is confirmed"
#   bash scripts/handover.sh <partner-name>      # interactive (asks each gate)
#   bash scripts/handover.sh list                # cars currently out
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
G(){ printf "\033[42;30m %s \033[0m\n" "$1"; }
R(){ printf "\033[41;97m %s \033[0m\n" "$1"; }
Y(){ printf "\033[43;30m %s \033[0m\n" "$1"; }
dim(){ printf "\033[2m%s\033[0m\n" "$1"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GR="$ROOT/.aixmos/grants"; HO="$ROOT/.aixmos/handovers"; mkdir -p "$HO"
ask(){ local q="$1" v; printf "  %s (y/n): " "$q" >&2; IFS= read -r v; case "$(printf '%s' "$v" | tr A-Z a-z)" in y|yes) return 0;; *) return 1;; esac; }

if [ "${1:-}" = "list" ]; then
  B "🚗 CARS OUT (handed to partners):"
  if ls "$HO"/*.md >/dev/null 2>&1; then
    for f in "$HO"/*.md; do
      nm=$(grep -i '^partner:' "$f" | head -1 | sed 's/^[^:]*: *//'); vin=$(grep -i '^vin:' "$f" | head -1 | sed 's/^[^:]*: *//')
      st=$(grep -i '^status:' "$f" | head -1 | sed 's/^[^:]*: *//')
      printf "  • %-18s VIN %-18s %s\n" "$nm" "${vin:-—}" "$st"
    done
  else dim "  (none out yet)"; fi
  exit 0
fi

NAME="${1:-}"; [ -n "$NAME" ] || { echo "usage: handover.sh <partner-name> [--vin V --insurance --losspayee --paid] | list"; exit 2; }
shift || true
VIN=""; INS=false; LP=false; PAID=false
while [ $# -gt 0 ]; do case "$1" in
  --vin) VIN="${2:-}"; shift 2;;
  --insurance) INS=true; shift;;
  --losspayee) LP=true; shift;;
  --paid) PAID=true; shift;;
  *) shift;; esac; done
slug="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"

clear 2>/dev/null || true
B "════════ CAR HANDOVER GATE — $NAME ════════"
dim "no GO until all four hold. this is what keeps you from bleeding."
echo
FAIL=0

# ① licensed dealer — read straight from their grant record (can't fake it)
REC="$GR/${slug}-GRANTED.md"
LICENSE=""; [ -f "$REC" ] && LICENSE="$(grep -i '^dealership_license:' "$REC" | head -1 | sed 's/^[^:]*: *//')"
if [ -n "$LICENSE" ] && [ "$LICENSE" != "n/a (non-car role)" ]; then G "① licensed dealer — $LICENSE ✓"
else R "① NO dealership license on their grant"; dim "   grant them as a licensed car partner first (scripts/grant.sh)"; FAIL=1; fi

# ② insurance proof + you as loss-payee
if $INS || { [ -t 0 ] && ask "② Do you have their INSURANCE PROOF in hand (covers this car)?"; }; then G "② insurance proof — in hand ✓"; else R "② insurance proof NOT confirmed"; dim "   get the policy/COI before the car moves"; FAIL=1; fi
if $LP || { [ -t 0 ] && ask "②b Are YOU listed as LOSS-PAYEE / additional insured on it?"; }; then G "②b loss-payee = you ✓"; else R "②b you are NOT the loss-payee"; dim "   their policy must name you — that's your payout if it's totaled"; FAIL=1; fi

# ③ paid upfront
if $PAID || { [ -t 0 ] && ask "③ Is their buy-in / first split PAID UPFRONT (money in hand)?"; }; then G "③ paid upfront ✓"; else R "③ NOT paid upfront"; dim "   no pay, no car. log it: scripts/deal.sh ... --paid"; FAIL=1; fi

# ④ title stays with you — doctrine, just confirm
if [ -t 0 ] && ! $INS; then ask "④ Confirm the TITLE stays in YOUR name (you keep ownership)?" && G "④ title retained by you ✓" || { R "④ title not retained"; FAIL=1; }
else G "④ title retained by you ✓ (doctrine: 50/50 splits money, never the car)"; fi

echo
if [ "$FAIL" = 0 ]; then
  cat > "$HO/${slug}.md" <<EOF
partner: $NAME
vin: ${VIN:-unrecorded}
license: $LICENSE
insurance_proof: yes   loss_payee: you
paid_upfront: yes      title: retained by X
status: OUT (handed over)
at: $(date -u +%FT%TZ)
EOF
  G "🚗 GO — hand over the car. You're protected on all four. Recorded."
  dim "   when it comes back / deal ends: rm $HO/${slug}.md (or revoke them)"
else
  R "⛔ NO-GO — do NOT release the car. Close every ✗ above first."
  dim "   one unmet gate is how you end up eating the loss. hold the keys."
  exit 1
fi
