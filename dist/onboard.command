#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# TMMT — plug-and-play onboarding (macOS / Linux). SELF-CONTAINED, no repo needed.
# Send this file to a teammate. They double-click it (Mac) or run:  bash onboard.command
# It shows THE MISSION, requires acceptance, runs the interview, and saves a profile
# they send back to you. No passwords, no installs, no internet required.
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")" 2>/dev/null || true
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
G(){ printf "\033[32m%s\033[0m\n" "$1"; }
R(){ printf "\033[31m%s\033[0m\n" "$1"; }
PHRASE="I ACCEPT THE MISSION"
norm(){ printf '%s' "$1" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:lower:]' '[:upper:]'; }
ask(){ printf "%s\n> " "$1" >&2; IFS= read -r r; printf '%s' "$r"; }

clear 2>/dev/null || true
B "════════════════ TMMT — THE MISSION ════════════════"
cat <<'M'
  Movement: Trap Money Moves Timeless (TMMT) — for the people, by the people.

  Mission: Help everyday people get out and bring their family with them — with
  systems, automation, and AI agents (AIXMOS) to run a real business and grow,
  ONE STEP AT A TIME, without having to ask or beg anyone.

  How we operate:
   - Agents-first. AIXMOS does the heavy lifting; people make the calls that matter.
   - One step at a time.   - Protect the owner and the family. Always.
   - Only great, valuable information moves through the network.
   - Earn it, own it. Access is granted by the owner, scoped, revocable.

  The ask: become an agent of the mission. Use AIXMOS to do what you're here to
  do, leave it stronger than you found it, and never act against the owner/family.
M
echo
B "You must accept the mission to continue."
printf "Type exactly:  %s\n> " "$PHRASE"; IFS= read -r ACK
if [ "$(norm "$ACK")" != "$(norm "$PHRASE")" ]; then R "Mission not accepted. Onboarding stopped."; exit 1; fi
G "✓ Mission acknowledged."
echo

NAME="$(ask 'Full name / handle:')"
ROLE="$(ask 'Role (operator | developer | vendor | teammate):')"
ROLE="$(printf '%s' "$ROLE" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
case "$ROLE" in operator|developer|vendor|teammate|owner) :;; *) ROLE="operator";; esac
WHAT="$(ask 'In one line: what will you own / move forward for the mission?')"
SKILLS="$(ask 'Your skills / tools (comma-separated):')"
STEP1="$(ask 'Your FIRST step — the one move you will make next:')"
CONSENT="$(ask 'Agree to UPHOLD THE OPERATOR STANDARDS (take work OFF the boss plate, do NOT blow up his phone, mission-first, honesty), keep everything confidential, least-privilege access, and never act against the owner/family? (yes/no):')"
case "$(printf '%s' "$CONSENT" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')" in y|yes) :;; *) R "Onboarding requires agreement. Stopped."; exit 1;; esac

slug="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
DEST="$HOME/Desktop"; [ -d "$DEST" ] || DEST="$HOME"
F="$DEST/TMMT-onboarding-${slug:-me}.txt"
cat > "$F" <<EOF
TMMT ONBOARDING — $NAME
mission_accepted: YES ("$PHRASE")
at: $(date -u +%FT%TZ)
device: $(uname -s) $(uname -m) — $(hostname)
role: $ROLE
owns: $WHAT
skills: $SKILLS
first_step: $STEP1
agreed: yes
confidentiality_agreed: yes (keep how/why secret)
standards_agreed: yes (Operator Standards — phone rule, mission-first, honesty)
EOF

clear 2>/dev/null || true
G "✓ Welcome, $NAME — you're in (pending the owner's grant)."
echo
B "YOUR WORKFLOW:"
cat <<EOF
  1. Mission accepted ✓
  2. You start in DEV (your sandbox) — you cannot break anything live.
  3. Your first step: $STEP1
  4. SECURE YOURSELF first: set up a password manager (iCloud/Dashlane), unique
     passwords + MFA on email, bank, socials. The owner will send you the tools.
  5. Access is granted by X after he reviews this — one step at a time.
EOF
echo
B "LAST STEP — send your profile back to X:"
echo "  $F"
echo "  (text/email/AirDrop that file to him so he can grant your access.)"
echo
printf "Press ENTER to close. "; IFS= read -r _
