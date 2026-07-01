#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# revoke.sh — the owner's REMOVE button, and the accountability rule.
#
#   No one gets in without a YES (grant.sh). This is the other half:
#   anyone can be put OUT instantly — and if they got in through a breach,
#   whoever OPENED THE DOOR for them leaves too. The owner (X) is the table;
#   the table never gets revoked. Everyone else eats by invitation.
# ───────────────────────────────────────────────────────────────────────────
#   bash scripts/revoke.sh <name>                  # remove one person
#   bash scripts/revoke.sh <name> --reason "..."   # with a reason on the record
#   bash scripts/revoke.sh <name> --breach         # + revoke whoever vouched (door-opener)
#   bash scripts/revoke.sh chain                    # who's in + who vouched for them
#   bash scripts/revoke.sh log                      # revocation history
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
R(){ printf "\033[41;97m %s \033[0m\n" "$1"; }
Y(){ printf "\033[43;30m %s \033[0m\n" "$1"; }
G(){ printf "\033[42;30m %s \033[0m\n" "$1"; }
dim(){ printf "\033[2m%s\033[0m\n" "$1"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GR="$ROOT/.aixmos/grants"; LOG="$GR/revoked.log"; mkdir -p "$GR"

field(){ grep -iE "^$2:" "$1" 2>/dev/null | head -1 | sed -E 's/^[^:]*:[[:space:]]*//'; }
slugify(){ printf '%s' "$1" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'; }
is_owner(){ case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in *"x (owner)"*|x|owner|"x (owner)") return 0;; *) return 1;; esac; }

# ── chain: who's in, and who opened the door for them ───────────────────────
if [ "${1:-}" = "chain" ]; then
  B "🔗 WHO'S IN — and who vouched for them:"
  if ls "$GR"/*-GRANTED.md >/dev/null 2>&1; then
    for f in "$GR"/*-GRANTED.md; do
      nm="$(field "$f" '# GRANTED' )"; nm="$(head -1 "$f" | sed -E 's/# GRANTED — //; s/ \(.*//')"
      sp="$(field "$f" sponsored_by)"; sp="${sp:-X (owner)}"
      printf "  ✓ %-22s ← vouched by: %s\n" "$nm" "$sp"
    done
  else dim "  (no one granted yet)"; fi
  exit 0
fi
if [ "${1:-}" = "log" ]; then
  B "🚪 REVOCATION HISTORY:"; [ -f "$LOG" ] && tail -40 "$LOG" | sed 's/^/  /' | grep . || dim "  (none — nobody's been removed)"
  exit 0
fi

NAME="${1:-}"; [ -n "$NAME" ] || { echo "usage: revoke.sh <name> [--reason \"...\"] [--breach]   |   revoke.sh chain|log"; exit 2; }
shift || true
REASON="revoked by owner"; BREACH=false
while [ $# -gt 0 ]; do case "$1" in
  --reason) REASON="${2:-revoked by owner}"; shift 2;;
  --breach) BREACH=true; REASON="BREACH — unauthorized entry traced here"; shift;;
  *) shift;; esac; done

revoke_one(){  # $1 = name; $2 = reason ; prints UI to stderr, echoes the sponsor to stdout
  local name="$1" reason="$2" slug rec sponsor tag
  slug="$(slugify "$name")"; rec="$GR/${slug}-GRANTED.md"
  if [ ! -f "$rec" ]; then Y "  ‼ no active grant for '$name' (already out, or never in)" >&2; return 1; fi
  sponsor="$(field "$rec" sponsored_by)"; sponsor="${sponsor:-X (owner)}"
  tag="$(field "$rec" tailnet_tag)"
  # move the record to REVOKED + stamp it
  { cat "$rec"; printf '\nrevoked_at: %s\nrevoked_reason: %s\n' "$(date -u +%FT%TZ)" "$reason"; } > "$GR/${slug}-REVOKED.md"
  rm -f "$rec"
  printf '%s\tREVOKED\t%s\tsponsor=%s\treason=%s\n' "$(date -u +%FT%TZ)" "$name" "$sponsor" "$reason" >> "$LOG"
  {
    R "  🚪 OUT — $name"
    echo "     off-boarding (do these now):"
    echo "       • Tailscale admin → remove their device / key  ${tag:+($tag)}"
    echo "       • rotate any brokered secret they could have seen (docs/SECRET-ROTATION.md)"
    echo "       • revoke their app login (Supabase dashboard → Auth → delete user)"
    echo "       • GHL/portal → remove their seat"
  } >&2
  printf '%s' "$sponsor"   # return the door-opener (stdout only)
  return 0
}

clear 2>/dev/null || true
if $BREACH; then R "════════ BREACH RESPONSE — seal the door ════════"; else B "════════════ REVOKE ════════════"; fi
echo "  Target : $NAME"
echo "  Reason : $REASON"
$BREACH && echo "  Rule   : whoever opened the door leaves too (owner is immune)"
echo
printf "Type  REVOKE  to confirm (anything else = cancel): "; IFS= read -r ANS
case "$(printf '%s' "$ANS" | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]')" in
  REVOKE) : ;;
  *) G "Cancelled. Nothing changed."; exit 0;;
esac
echo

# primary removal (no pipe, so $? reflects revoke_one; UI is on stderr)
SPONSOR="$(revoke_one "$NAME" "$REASON")"; PRIMARY_OK=$?

# breach cascade: walk the sponsor chain, removing each door-opener, stop at owner
if $BREACH && [ "$PRIMARY_OK" = 0 ]; then
  echo
  R "  ── ACCOUNTABILITY CASCADE ──"
  next="$SPONSOR"; guard=0
  while [ -n "$next" ] && [ "$guard" -lt 10 ]; do
    guard=$((guard+1))
    if is_owner "$next"; then G "  🪑 chain ends at X (owner) — the table stays. No further removals."; break; fi
    echo; dim "  door opened by: $next → they're accountable, removing…"
    next="$(revoke_one "$next" "BREACH cascade — vouched for a door that was breached")" || break
  done
fi

echo
if $BREACH; then
  R "Door sealed. Everyone in the breach chain is out — except the owner."
else
  G "Done. $NAME no longer has a seat."
fi
dim "Recorded in $LOG · view the chain anytime: bash scripts/revoke.sh chain"
