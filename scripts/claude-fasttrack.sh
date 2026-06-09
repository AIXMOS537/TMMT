#!/usr/bin/env bash
# Claude Code fast-track launcher for TMMT revenue roadmap.
# Usage:
#   bash scripts/claude-fasttrack.sh              # quick start
#   bash scripts/claude-fasttrack.sh --instruction # one-line mission for claude CLI
#   bash scripts/claude-fasttrack.sh --prompt      # full runbook (stdout)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNBOOK="$ROOT/docs/CLAUDE-CODE-RUNBOOK.md"

if [[ ! -f "$RUNBOOK" ]]; then
  echo "ERROR: Missing $RUNBOOK" >&2
  exit 1
fi

print_quick_start() {
  cat <<EOF
TMMT Claude Code Fast-Track
===========================

Repo:   ~/Projects/TMMT  (GitHub AIXMOS537/TMMT, branch master)
Runbook: docs/CLAUDE-CODE-RUNBOOK.md

START HERE — paste into Claude Code:

  cd ~/Projects/TMMT && claude "\$(bash scripts/claude-fasttrack.sh --instruction)"

Or dump the full prompt:

  bash scripts/claude-fasttrack.sh --prompt | pbcopy

Phases:
  1. Commit & deploy /kits landing
  2. GHL + Stripe (unblocks sales) — STOP for GHL login
  3. Wire fulfillment (webhooks, tags, workflows)
  4. Physical channel (print, USB build)
  5. Production cleanup (customer-intake 404, Vercel, DNS)
  6. Safety — do NOT merge feature/rescue-dispatch-core

Pre-flight (run now):
  cd ~/Projects/TMMT && npm run build
EOF
}

case "${1:-}" in
  --instruction)
    cat <<'EOF'
You are executing the TMMT revenue fast-track on branch master in ~/Projects/TMMT (AIXMOS537/TMMT).

Read and follow docs/CLAUDE-CODE-RUNBOOK.md phase by phase (1–6). Work autonomously where possible.

Rules:
- Stay on master. Do NOT merge, cherry-pick, or deploy feature/rescue-dispatch-core.
- Run npm run build before any git push; fix TypeScript/build errors before proceeding.
- At Phase 2 GHL gates: STOP and ask the user to complete GoHighLevel UI steps (Stripe connect, products, checkout URLs). Do not guess GHL credentials.
- Only commit when a phase’s verification commands pass and the user has not forbidden commits for that step.
- Use absolute paths. Reference docs/SALES-CHANNELS.md, docs/GHL-WEBHOOK-SETUP.md, DEPLOY.md.

Start with Phase 1 pre-flight, then proceed in order. Report status after each phase with checkboxes and curl results.
EOF
    ;;
  --prompt)
    echo "# Claude Code — paste everything below as your first message"
    echo ""
    cat "$RUNBOOK"
    ;;
  --help|-h)
    echo "Usage: bash scripts/claude-fasttrack.sh [--instruction|--prompt|--help]"
    ;;
  *)
    print_quick_start
    ;;
esac
