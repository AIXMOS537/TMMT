#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# grant.sh — the owner's one-tap GRANT button.
# Drop in a person's onboarding card, see it, say YES, and it tells you the exact
# 3 things to give them. Only YOU run this. Nobody gets in without your YES.
# ───────────────────────────────────────────────────────────────────────────
#   bash scripts/grant.sh ~/Downloads/TMMT-onboarding-xxx.txt
#   bash scripts/grant.sh                # auto-find cards on Desktop/Downloads
#   bash scripts/grant.sh list           # who you've already granted
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
G(){ printf "\033[42;30m %s \033[0m\n" "$1"; }
Y(){ printf "\033[43;30m %s \033[0m\n" "$1"; }
dim(){ printf "\033[2m%s\033[0m\n" "$1"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GR="$ROOT/.aixmos/grants"; mkdir -p "$GR"

if [ "${1:-}" = "list" ]; then
  B "✅ Already granted:"; ls "$GR"/*-GRANTED.md >/dev/null 2>&1 && for f in "$GR"/*-GRANTED.md; do echo "  ✓ $(basename "$f" -GRANTED.md)"; done || dim "  (none yet)"
  exit 0
fi

# find the card
F="${1:-}"
if [ -z "$F" ]; then
  F="$(ls -t "$HOME/Desktop"/TMMT-onboarding-*.txt "$HOME/Downloads"/TMMT-onboarding-*.txt "$ROOT/.aixmos/operators"/*.md 2>/dev/null | head -1)"
fi
[ -n "$F" ] && [ -f "$F" ] || { echo "✗ no onboarding card found. Pass the file:  bash scripts/grant.sh /path/to/TMMT-onboarding-*.txt"; exit 1; }

get(){ grep -iE "^$1:" "$F" 2>/dev/null | head -1 | sed -E 's/^[^:]*:[[:space:]]*//'; }
NAME="$(head -1 "$F" | sed -E 's/.*ONBOARDING[ ]*[—-]+[ ]*//; s/^# *//; s/Onboarding *[—-]+ *//')"
[ -n "$NAME" ] || NAME="$(get name)"; [ -n "$NAME" ] || NAME="$(basename "$F")"
ROLE="$(get role)"; ROLE="${ROLE:-operator}"
OWNS="$(get owns)"; STEP="$(get first_step)"; CONF="$(get confidentiality_agreed)"
slug="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"

clear 2>/dev/null || true
B "════════════ GRANT REVIEW ════════════"
echo "  👤 Name : $NAME"
echo "  🎒 Role : $ROLE"
echo "  💼 Owns : ${OWNS:-—}"
echo "  👣 First: ${STEP:-—}"
printf "  🔒 Confidential agreed : %s\n" "$([ -n "$CONF" ] && echo yes || echo '? (check card)')"
echo
B "Say the word, boss. Grant $NAME access?"
printf "Type  YES  to grant (anything else = no): "; IFS= read -r ANS
case "$(printf '%s' "$ANS" | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]')" in
  YES|Y) : ;;
  *) Y "Not granted. $NAME stays locked out. Nothing changed."; exit 0;;
esac

# tag by role
case "$ROLE" in
  developer) TAG="tag:dev";  ENVN="DEV branch + the gate";;
  vendor)    TAG="tag:vendor"; ENVN="their scoped vendor portal only";;
  *)         TAG="tag:operator"; ENVN="DEV (their sandbox) — TEST/PROD earned later";;
esac

REC="$GR/${slug}-GRANTED.md"
cat > "$REC" <<EOF
# GRANTED — $NAME ($ROLE)
granted_by: Muhammad Taha (owner)
at: $(date -u +%FT%TZ)
scope: $ENVN
tailnet_tag: $TAG
secrets: brokered only (no raw prod keys)
owns: $OWNS
first_step: $STEP
EOF

clear 2>/dev/null || true
G "✅ GRANTED — welcome $NAME"
echo
B "Now give them these 3 things (that's it):"
echo "  1️⃣  ROLE → $NAME is an $ROLE. Access: $ENVN."
echo "  2️⃣  TAILSCALE → send a Tailscale invite, then tag their device  $TAG"
echo "       (in the Tailscale admin; least-privilege per infra/tailscale-acl.jsonc)"
echo "  3️⃣  TOOLS → send them their starter kit; secrets are BROKERED, never raw keys."
echo
dim "Recorded: $REC"
dim "They start in DEV. They can't touch PROD. You can revoke anytime."
B "One operator in. 👑 One step at a time."
