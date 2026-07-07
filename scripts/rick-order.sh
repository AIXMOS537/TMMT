#!/usr/bin/env bash
# rick-order.sh — Carry drops work to Rick M1. YOU DON'T EXECUTE. Rick does.
#
#   bash scripts/rick-order.sh "fix the credit form validation"
#   bash scripts/rick-order.sh --all   # drop full A-Z corporate queue
#   rick-order "build fleet upload pattern"
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$INBOX/done"

drop(){
  local score="$1" name="$2" type="$3"
  shift 3
  local f="$INBOX/law-${score}-${TS}-${name}.md"
  cat > "$f" <<EOF
---
type: ${type}
score: ${score}
owner: rick-sorkin
device: m1-max
---
# RICK EXECUTES — ${name}

Rick Sorkin · M1 · PROJECT X HAILMARY
Carry dropped this. Taha does NOT run this on Carry.

$*
EOF
  echo "✓ Rick mission → $(basename "$f")"
}

if [[ "${1:-}" == "--all" ]]; then
  drop 10000 rick-owns-everything code <<'EOF'
## Rick owns execution — M1 is primary forge

Run in order on M1 (this machine):
1. bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh  (once only if daemon not loaded)
2. bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh
3. cd ~/projects/TMMT && bash scripts/tmmt sync && npm run build
4. bash scripts/tmmt go 2
5. Drain FLEET-INBOX via rick-alive-executor / m1-fleet-executor forever

## GHL prep (Rick does — no browser on Carry)
- npm run ghl:check → write report to ~/Sync/rick/OUTBOUND/ghl-blockers.md
- Create ~/.config/tmmt/ghl-paste.env TEMPLATE with all P0 keys and PLACEHOLDER=https://PASTE-IN-GHL
- Write step-by-step GHL UI checklist for Taha → ~/Sync/rick/ESCALATED/GHL-OWNER-5MIN.md
  (only thing Taha does: log into GHL, copy 5 URLs, paste file, say done)
- When ghl-paste.env has real https URLs: npm run ghl:sync-vercel (needs vercel auth on M1)
- ESCALATE deploy — never vercel --prod without Taha OK

## Code queue (Rick ships on rick/* branches)
- Fleet doc-upload pattern (admin pages, reuse document-storage.ts)
- smoke-prod expand for /lp and /credit
- GHL webhook workflow doc for hot-ready-now tag
- Operator training polish

Local Ollama + aider only. Zero paid API. Report to FLEET-INBOX/done/
EOF

  drop 9999 brainiac-forever plan <<'EOF'
Ping Brainiac every forever-loop tick. M1 owns Brainiac forever.
bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh
Log to ~/Library/Logs/brainiac-via-m1.log
EOF

  drop 9998 trapper-corporate-build code <<'EOF'
Read docs/TRAPPER-CORPORATE-DAILY.md. Execute highest-value build tasks.
Push rick/* branches. npm run build must pass. Never merge to master.
EOF

  echo ""
  echo "Rick owns it. M1 drains via Syncthing. You: watchtower"
  exit 0
fi

[[ -n "${1:-}" ]] || {
  echo "Usage: bash scripts/rick-order.sh \"task description\""
  echo "       bash scripts/rick-order.sh --all"
  exit 1
}

# Classify type from keywords
msg="$*"
type=plan
echo "$msg" | grep -qiE '\b(fix|bug|implement|refactor|build|code|script|npm|test|wire|add)\b' && type=code
echo "$msg" | grep -qiE '\b(draft|content|write|post|copy|caption)\b' && type=content

drop 5000 "carry-order" "$type" "$msg"
echo "Syncthing → M1 Rick. You stay on Carry."
