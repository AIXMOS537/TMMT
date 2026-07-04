#!/usr/bin/env bash
#
# onboard-interview.sh — the front door for anyone joining the movement
# (operator / developer / vendor / teammate). It opens with THE MISSION and will
# NOT proceed until the person acknowledges it. Then a thorough, role-scoped
# interview. Output is a LOCAL profile the owner reviews before granting access.
# ---------------------------------------------------------------------------
#   bash scripts/onboard-interview.sh                      # interactive
#   bash scripts/onboard-interview.sh --name "Jane" --role developer --ack "I ACCEPT THE MISSION"
#
# Roles: operator | developer | vendor | teammate
# Nothing here grants access — it records intent + the mission acknowledgment.
# Access is granted by the owner per docs/IT-SUPPORT-TEAM-PLAYBOOK.md + the ACL.
# ---------------------------------------------------------------------------
set -uo pipefail
bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
die(){ printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

NAME=""; ROLE=""; ACK=""
while [ $# -gt 0 ]; do case "$1" in
  --name) NAME="${2:-}"; shift 2;; --role) ROLE="${2:-}"; shift 2;; --ack) ACK="${2:-}"; shift 2;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) die "unknown arg: $1";;
esac; done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MISSION="$ROOT/config/mission.md"
[ -f "$MISSION" ] || die "mission file missing: $MISSION"
PHRASE="$(grep -oE 'I ACCEPT THE MISSION' "$MISSION" | head -1)"; PHRASE="${PHRASE:-I ACCEPT THE MISSION}"

# ---- STEP 0: THE MISSION (acknowledged before anything else) ----
clear 2>/dev/null || true
bold "════════════════ TMMT — THE MISSION ════════════════"
sed -n '/^# THE MISSION/,$p' "$MISSION" | sed '/Acknowledgment phrase/q' | sed 's/^/  /'
echo
bold "You must accept the mission to continue."
if [ -z "$ACK" ]; then
  printf "Type exactly:  %s\n> " "$PHRASE"; IFS= read -r ACK
fi
# normalize: strip CR + surrounding whitespace, uppercase — so a trailing space or
# different case never rejects a correct acknowledgment
norm(){ printf '%s' "$1" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:lower:]' '[:upper:]'; }
[ "$(norm "$ACK")" = "$(norm "$PHRASE")" ] || die "Mission not acknowledged (got: '$ACK'). Onboarding stopped."
ok "Mission acknowledged."

# ---- STEP 1: the interview ----
# prompt goes to stderr so $(ask ...) captures ONLY the typed answer
ask(){ local q="$1" v=""; printf "%s\n> " "$q" >&2; IFS= read -r v; printf '%s' "$v"; }
[ -n "$NAME" ] || NAME="$(ask 'Full name / handle:')"
[ -n "$ROLE" ] || ROLE="$(ask 'Role (owner | operator | developer | vendor | teammate):')"
ROLE="$(printf '%s' "$ROLE" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
case "$ROLE" in owner|operator|developer|vendor|teammate) :;; *) die "role must be owner|operator|developer|vendor|teammate";; esac

WHAT="$(ask 'In one line: what will you own / move forward for the mission?')"
SKILLS="$(ask 'Your skills / tools (comma-separated):')"
SCOPE="$(ask 'What systems do you need access to? (be specific, least-privilege):')"
STEP1="$(ask 'Your FIRST step — the one move you will make next (one step at a time):')"
# Car-partner minimum requirement: a dealership license. Operators must provide one
# (the owner partners 1 car, 50/50; a license is the non-negotiable minimum).
LICENSE=""
if [ "$ROLE" = "operator" ]; then
  LICENSE="$(ask 'Dealership license number (REQUIRED for any car partnership — no license, no grant). Leave blank ONLY if you will never touch a vehicle:')"
fi
CONSENT="$(ask 'Do you agree to: UPHOLD THE OPERATOR STANDARDS (take work OFF the boss plate, do not blow up his phone, mission-first, honesty), keep everything confidential, least-privilege access, the fact-check gate, and never acting against the owner/family? (yes/no):')"
case "$(printf '%s' "$CONSENT" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')" in y|yes) :;; *) die "Onboarding requires agreement to the rules. Stopped.";; esac

# ---- STEP 2: record a LOCAL profile (owner reviews before granting) ----
OUT="$ROOT/.aixmos/operators"; mkdir -p "$OUT"
slug="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
F="$OUT/${slug:-anon}-$(date -u +%Y%m%d).md"
cat > "$F" <<EOF
# Onboarding — $NAME
mission_acknowledged: true ("$PHRASE")
at: $(date -u +%FT%TZ)   host: $(hostname)
role: $ROLE
owns: $WHAT
skills: $SKILLS
access_requested: $SCOPE
first_step: $STEP1
dealership_license: ${LICENSE:-}
agreed_to_rules: yes
EOF

if [ "$ROLE" = owner ]; then
  cat >> "$F" <<EOF

## owner
- This is THE OWNER. Owner access is established via the owner-seal
  (scripts/owner-seal.sh), not granted through this recruit flow.
- Full authority: approvals, the word, the kill-switch. Protect first.
EOF
else
  cat >> "$F" <<EOF

## owner action (not granted yet)
- [ ] verify identity + settle anything owed
- [ ] grant role (tailnet tag, env access) per docs/IT-SUPPORT-TEAM-PLAYBOOK.md §7
- [ ] scope secrets (brokered, never raw prod keys)
EOF
fi

echo
if [ "$ROLE" = owner ]; then
  ok "Welcome back, $NAME — the owner. Mission re-affirmed. Profile saved:"
  echo "   $F"
  bold "Your first step: $STEP1"
  echo "You hold the word. Owner access is set by the owner-seal, not this flow."
else
  ok "Welcome, $NAME — mission accepted, profile saved (LOCAL, owner reviews):"
  echo "   $F"
  bold "Your first step: $STEP1"
  echo "Access is granted by the owner after review — not automatically. One step at a time."
fi
