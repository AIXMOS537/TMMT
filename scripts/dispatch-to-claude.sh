#!/usr/bin/env bash
# dispatch-to-claude — send work from Cursor / shell → Claude Code (or swarm task file)
#
# Usage:
#   bash scripts/dispatch-to-claude.sh "Your task here"
#   bash scripts/dispatch-to-claude.sh --file docs/CLAUDE-FAMILY-MESH-ULTIMATE-PROMPT.md
#   bash scripts/dispatch-to-claude.sh --swarm "Task for parallel agent"
#   bash scripts/dispatch-to-claude.sh --print "Read-only question"
#
# Claude Cowork: sessions live at
#   ~/Library/Application Support/Claude/local-agent-mode-sessions/
# Cursor cannot drive Cowork directly — paste the same prompt there, or use this → Claude Code CLI.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="interactive"
TASK=""
SWARM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --print|-p) MODE="print"; shift ;;
    --swarm) SWARM=1; shift ;;
    --file|-f)
      [[ -n "${2:-}" ]] || { echo "Usage: --file path" >&2; exit 1; }
      TASK="$(cat "$2")"
      shift 2
      ;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) TASK="$*"; break ;;
  esac
done

[[ -n "$TASK" ]] || TASK="${*:-Read docs/FINANCIAL-PRIORITY-LEDGER.md and imports/finance/master-bills.csv. One improvement only.}"

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI not found. Install: npm i -g @anthropic-ai/claude-code" >&2
  echo "Task saved anyway — run manually after install." >&2
  mkdir -p "$ROOT/.swarm"
  echo "$TASK" > "$ROOT/.swarm/last-claude-dispatch.txt"
  exit 1
fi

if [[ "$SWARM" -eq 1 ]]; then
  mkdir -p "$ROOT/.swarm"
  echo "$TASK" > "$ROOT/.swarm/swarm-dispatch.txt"
  echo "Swarm task written: $ROOT/.swarm/swarm-dispatch.txt"
  echo "Launch: cd $ROOT && npm run swarm -- up 1"
  echo "Or: bash scripts/swarm.sh claim && bash scripts/swarm.sh run"
  exit 0
fi

cd "$ROOT"
CONTEXT="Repo: $ROOT · Machine: $(cat .swarm/machine 2>/dev/null || echo unknown) · Dispatch from Cursor/shell $(date -Iseconds)"
FULL="${CONTEXT}

${TASK}"

case "$MODE" in
  print)
    claude -p "$FULL" --allowed-tools "Read,Grep,Glob"
    ;;
  *)
    echo "Launching Claude Code interactive session..."
    echo "Tip: paste task if prompt doesn't auto-fill."
    exec claude "$FULL"
    ;;
esac
