#!/usr/bin/env bash
# ============================================================
# ACTIVATE OPERATOR — the owner's one-tap button. PROJECT X only.
# When an operator sends back their AIXMOS-operator-<name>.txt profile,
# drop it in (or just run this and it finds it). It shows you the profile,
# you say YES, and it:
#   1) records the grant            (.aixmos/grants/)
#   2) provisions their license     (scripts/provision-operators.mjs — dry-run first)
#   3) tells you to approve their device in Tailscale
#   4) prints the 3 things to hand them
# Nobody gets in without your YES. You stay the keyholder.
#
#   bash activate-operator.command [path/to/AIXMOS-operator-name.txt]
# ============================================================
set -uo pipefail
G=$'\e[42;30m'; Y=$'\e[43;30m'; BD=$'\e[1m'; D=$'\e[2m'; R=$'\e[31m'; X=$'\e[0m'
say(){ printf '\n%s%s%s\n' "$BD" "$*" "$X"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  for _d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT" "$HOME/TMMT" "$HOME/Documents/TMMT"; do
    [ -d "$_d/.git" ] && { ROOT="$_d"; break; }
  done
fi
ROOT="${ROOT:-$HOME/projects/TMMT}"
GR="$ROOT/.aixmos/grants"; mkdir -p "$GR"

# find the profile card
CARD="${1:-}"
if [ -z "$CARD" ]; then
  CARD="$(ls -t ~/Desktop/AIXMOS-operator-*.txt ~/Downloads/AIXMOS-operator-*.txt 2>/dev/null | head -1)"
fi
[ -n "$CARD" ] && [ -f "$CARD" ] || { echo "No operator profile found. Pass the path: bash activate-operator.command ~/Downloads/AIXMOS-operator-xxx.txt"; exit 1; }

printf '%s ACTIVATE OPERATOR %s\n' "$G" "$X"
say "Their profile ($CARD):"; sed 's/^/  /' "$CARD"
NAME="$(grep -i '^name:'  "$CARD" | head -1 | cut -d: -f2- | xargs)"
EMAIL="$(grep -i '^email:' "$CARD" | head -1 | cut -d: -f2- | xargs)"
MACH="$(grep -i '^machine:' "$CARD" | head -1 | cut -d: -f2- | xargs)"

printf '\n%s Activate %s <%s>? Type YES to proceed: %s' "$Y" "${NAME:-?}" "${EMAIL:-?}" "$X"; read -r ok
[ "$(printf '%s' "$ok" | tr '[:lower:]' '[:upper:]')" = "YES" ] || { echo "  Stopped. Nothing activated."; exit 0; }

read -p "  Commission % on the \$97 (default 30): " COMM; COMM="${COMM:-30}"
read -p "  Level (candidate/builder/partner, default candidate): " LVL; LVL="${LVL:-candidate}"

# 1) record the grant
GF="$GR/$(printf '%s' "${NAME:-op}" | tr '[:upper:] ' '[:lower:]-').txt"
{ echo "operator: $NAME <$EMAIL>"; echo "machine: $MACH"; echo "level: $LVL"; echo "commission_pct: $COMM"; echo "granted_utc: $(date -u +%FT%TZ)"; echo "scope: fenced operator — no owner keys"; } > "$GF"
printf '%s  ✓ grant recorded: %s%s\n' "$D" "$GF" "$X"

# 2) provision license/account (dry-run first, then confirm)
say "STEP — provision license/account"
if command -v node >/dev/null 2>&1 && [ -f "$ROOT/scripts/provision-operators.mjs" ] && [ -f "$ROOT/.env" ]; then
  CSV="$(mktemp)"; printf 'email,role,affiliate_code,name\n%s,operator,%s,%s\n' "$EMAIL" "$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]')" "$NAME" > "$CSV"
  ( cd "$ROOT" && node scripts/provision-operators.mjs --file "$CSV" --dry-run ) || true
  printf '\n%s  Run it for real? Type APPLY: %s' "$Y" "$X"; read -r go
  if [ "$(printf '%s' "$go" | tr '[:lower:]' '[:upper:]')" = "APPLY" ]; then
    ( cd "$ROOT" && node scripts/provision-operators.mjs --file "$CSV" ) && printf '%s  ✓ provisioned — give them the one-time password OUT OF BAND (Signal/iMessage)%s\n' "$D" "$X"
  else echo "  Skipped provisioning (grant + device steps still recorded)."; fi
  rm -f "$CSV"
else
  printf '%s  Provision manually: cd ~/Projects/TMMT && node scripts/provision-operators.mjs --file <csv>  (needs .env)%s\n' "$D" "$X"
fi

# 3) device approval
say "STEP — approve their device on your network"
printf '  Tailscale admin → Machines → approve: %s%s%s  (device-approval is ON, so they can'\''t join without this)\n' "$BD" "${MACH:-their machine}" "$X"

# 4) handoff
printf '\n%s GIVE THEM 3 THINGS %s\n' "$G" "$X"
printf '  1) their one-time password (from provisioning, sent out-of-band)\n'
printf '  2) confirmation their device is approved on the network\n'
printf '  3) "you'\''re live — open a new terminal and type: menu"  (commission: %s%%, level: %s)\n\n' "$COMM" "$LVL"
printf '%s  They run on your stack now. You hold the keys.%s\n\n' "$D" "$X"
