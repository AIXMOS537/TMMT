#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RICK=1
banner(){ printf '\n== %s\n' "$*"; }
banner "1) Tailscale"
tailscale status >/dev/null 2>&1 && echo "  ok tailscale" || echo "  ! tailscale down"
banner "2) Mesh join"
bash "$ROOT/scripts/swarm-join.sh" --name rick 2>/dev/null || bash "$ROOT/scripts/swarm-join.sh" || true
banner "3) Agents + Ollama"
AGENTS="$HOME/Projects/AIXMOS-AGENTS"
# Self-clone the agent army if it isn't here yet — no manual step for X.
if [ ! -d "$AGENTS/.git" ]; then
  echo "  → agent army not present; cloning…"
  mkdir -p "$HOME/Projects"
  git clone --depth 1 https://github.com/AIXMOS537/AIXMOS-AGENTS.git "$AGENTS" 2>/dev/null \
    || echo "  ! clone failed (auth?) — run 'gh auth login' once, then re-run rick-sorkin up"
fi
if [ -d "$AGENTS" ]; then
  (cd "$AGENTS" && git pull --ff-only 2>/dev/null; npm install --silent 2>/dev/null; npm start >/tmp/rick-agents.log 2>&1 &)
  sleep 3
  curl -sf http://127.0.0.1:7777/healthz >/dev/null && echo "  ok agents :7777" || echo "  ! agents starting — see /tmp/rick-agents.log"
fi
command -v ollama >/dev/null && (ollama serve >/dev/null 2>&1 &) || true
banner "4) HAILMARY"
bash "$ROOT/scripts/hailmary" booyah 2>/dev/null || true
banner "DONE"
