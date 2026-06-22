#!/usr/bin/env bash
# Claude handoff launcher for cross-repo + Vercel production-readiness auditing.
#
# Usage:
#   bash scripts/claude-production-audit.sh
#   bash scripts/claude-production-audit.sh --instruction
#   bash scripts/claude-production-audit.sh --prompt

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT_FILE="$ROOT/docs/CLAUDE-HAILMARY-PRODUCTION-AUDIT-PROMPT.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: Missing prompt file: $PROMPT_FILE" >&2
  exit 1
fi

show_quick_start() {
  cat <<'EOF'
Project X HAILMARY — Claude Production Audit Handoff
====================================================

START HERE (paste into terminal):

  cd ~/Projects/TMMT && claude "$(bash scripts/claude-production-audit.sh --instruction)"

Copy full prompt to clipboard:

  bash scripts/claude-production-audit.sh --prompt | pbcopy

Open prompt file:

  docs/CLAUDE-HAILMARY-PRODUCTION-AUDIT-PROMPT.md
EOF
}

case "${1:-}" in
  --instruction)
    cat <<'EOF'
Run the full Project X HAILMARY production-readiness audit using docs/CLAUDE-HAILMARY-PRODUCTION-AUDIT-PROMPT.md.

Execute all required phases and produce all required outputs exactly:
- docs/PRODUCTION-READINESS-SCORECARD.md
- scripts/cursor-production-readiness.sh
- scripts/cursor-production-readiness-local.sh
- docs/MOE-LEGACY-LAUNCH-BLOCKERS.md

Do read-only discovery first, then implement only safe script/doc changes needed for repeatable audits.
Do not deploy or run destructive actions without explicit user confirmation.
EOF
    ;;
  --prompt)
    cat "$PROMPT_FILE"
    ;;
  --help|-h)
    echo "Usage: bash scripts/claude-production-audit.sh [--instruction|--prompt]"
    ;;
  *)
    show_quick_start
    ;;
esac

