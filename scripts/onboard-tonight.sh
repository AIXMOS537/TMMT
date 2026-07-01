#!/usr/bin/env bash
#
# onboard-tonight.sh — run a roster of people through the ENTIRE onboarding +
# workflow in one sitting. Defaults to the founding two: Moe Legacy + Ayyan Khan.
# ---------------------------------------------------------------------------
# For each person it runs:
#   1. Mission-gated interview (must accept THE MISSION) — captures role + profile
#   2. Their personalized workflow card (environment, tools, SECURE-YOUR-ACCOUNTS,
#      first task) saved locally
#   3. Adds them to the owner's grant queue (access is granted by you, after review)
#
#   bash scripts/onboard-tonight.sh                          # Moe Legacy + Ayyan Khan
#   bash scripts/onboard-tonight.sh --add "Name:role" ...    # custom roster
#   roles: owner | operator | developer | vendor | teammate
# ---------------------------------------------------------------------------
set -uo pipefail
bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
hr(){ printf "\033[2m%s\033[0m\n" "────────────────────────────────────────────────────────"; }
pause(){ printf "\n\033[1m%s\033[0m " "$1"; IFS= read -r _; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"
S="$ROOT/scripts"
[ -x "$S/onboard-interview.sh" ] || { echo "missing scripts/onboard-interview.sh"; exit 1; }

# roster: "Name:role"
ROSTER=("Moe Legacy:operator" "Ayyan Khan:operator")
CUSTOM=()
while [ $# -gt 0 ]; do case "$1" in
  --add) CUSTOM+=("${2:?}"); shift 2;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) echo "unknown arg: $1"; exit 2;;
esac; done
[ ${#CUSTOM[@]} -gt 0 ] && ROSTER=("${CUSTOM[@]}")

OUT="$ROOT/.aixmos/operators"; mkdir -p "$OUT"

workflow_card(){ # $1=name $2=role $3=slug
  local name="$1" role="$2" slug="$3" tools card
  case "$role" in
    operator) tools="TMMT Ops app · GHL pipeline · your role dashboard · the daily mission board";;
    developer) tools="the repo (DEV branch) · verify-gate · the LiteLLM router · staging";;
    vendor)   tools="your scoped vendor portal · assigned tickets only";;
    *)        tools="your role dashboard";;
  esac
  card="$OUT/${slug}-workflow.md"
  cat > "$card" <<EOF
# Workflow — $name ($role)
generated: $(date -u +%FT%TZ)

## 1. Mission — accepted ✓ (config/mission.md)
## 2. Your environment: DEV (your sandbox)
   - One canonical checkout. Run \`bash scripts/whereami.sh\` so you always know where you are.
   - You work on your own branch; nothing you do can touch PROD.
## 3. Your tools
   - $tools
## 4. SECURE YOUR OWN ACCOUNTS (do this first — protect yourself)
   - bash scripts/account-discover.sh --merge   # map your accounts (no passwords read)
   - bash scripts/account-hardening.sh top       # the ~30 that matter
   - Harden each: unique password in a vault + MFA. One at a time.
## 5. The rules (docs/DATA-ACCESS-CHARTER.md)
   - You see only your own + your assigned clients' data. Clients own their data.
   - Outbound/irreversible actions need owner approval.
## 6. Your first task
   - (from your interview — see ${slug}-*.md)

## OWNER GRANT (not active yet — X reviews)
- [ ] verify identity + settle anything owed
- [ ] grant role + scope (tailnet tag, env access) per docs/IT-SUPPORT-TEAM-PLAYBOOK.md §7
- [ ] send Tailscale invite + brokered (not raw) secrets
EOF
  echo "$card"
}

bold "╔══════════════════════════════════════════════════╗"
bold "║   TMMT — FOUNDING ONBOARDING (tonight)            ║"
bold "╚══════════════════════════════════════════════════╝"
echo "Tonight we onboard: $(printf '%s, ' "${ROSTER[@]%%:*}" | sed 's/, $//')"
echo "Each person accepts the mission, secures their own accounts, and gets their workflow."
hr

DONE=()
for entry in "${ROSTER[@]}"; do
  name="${entry%%:*}"; role="${entry##*:}"
  slug="$(printf '%s' "$name" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
  echo; bold "▶ Hand the keyboard to: $name   (role: $role)"
  pause "When $name is ready, press ENTER to begin their mission + interview…"
  bash "$S/onboard-interview.sh" --name "$name" --role "$role" || { echo "⚠ $name did not complete onboarding (mission not accepted or rules declined). Skipping."; continue; }
  card="$(workflow_card "$name" "$role" "$slug")"
  ok "$name onboarded. Workflow saved: $card"
  echo "   Next for $name: run steps 4 (secure accounts) → 6 (first task) from the card."
  DONE+=("$name")
  hr
done

echo
bold "== TONIGHT'S RESULT =="
ok "Onboarded: $(printf '%s, ' "${DONE[@]}" | sed 's/, $//' || echo none)"
echo "Profiles + workflows: $OUT/"
bold "Owner (you) — grant access after review:"
for n in "${DONE[@]}"; do echo "  [ ] $n — verify, grant role + scope, send Tailscale invite (least-privilege)"; done
echo
echo "Everyone starts in DEV. TEST/PROD is earned. One step at a time."
