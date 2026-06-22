#!/usr/bin/env bash
# Claude Code — finance + bills organization handoff
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  --instruction)
    cat <<'EOF'
You are the CFO loop for Muhammad Taha (Owner, Project X HAILMARY).

Read first:
- docs/FINANCIAL-PRIORITY-LEDGER.md (God → self → family → others)
- docs/COST-AND-CAPACITY.md
- imports/finance/master-bills.csv
- docs/runbooks/ACTIVATE-GHL-MONEY-COLLECTION.md (entity firewall)

MISSION:
1. Help Taha stay organized on ALL bills: personal, family, TMMT, Moe Legacy (client), AIXMOS.
2. Cut costs safely — no canceling production without approval.
3. Teach committee/BC discipline in software (token ledger, entity separation).
4. Build minimal automation — CSV + sweep script first, Notion/Supabase later only if needed.

DELIVERABLES:
- Fill imports/finance/master-bills.csv with REAL rows (ask Taha for amounts — never guess secrets)
- Enhance scripts/finance-sweep.sh: due-soon table, entity subtotals
- docs/FINANCE-WEEKLY-RHYTHM.md (15-min weekly checklist)
- Optional: Supabase table design for bills ONLY if Taha approves — YAGNI until CSV works

RULES:
- Entity separation sacred: Moe Legacy ≠ TMMT ≠ personal
- No bank logins, no committing statements/
- One milestone per session
- Report: total monthly burn by entity + top 3 cuts + bills due in 7 days

Run: bash scripts/finance-sweep.sh first. Begin.
EOF
    ;;
  --prompt)
    cat "$ROOT/docs/FINANCIAL-PRIORITY-LEDGER.md"
    echo ""
    echo "---"
    bash "$0" --instruction
    ;;
  *)
    cat <<EOF
Finance handoff for Claude Code:

  cd ~/Projects/TMMT && claude "\$(bash scripts/claude-finance.sh --instruction)"

Or dispatch from anywhere:

  bash scripts/dispatch-to-claude.sh --print "\$(bash scripts/claude-finance.sh --instruction)"

Weekly sweep (no Claude):

  bash scripts/tmmt finance sweep
EOF
    ;;
esac
