#!/usr/bin/env bash
# office-up-rick — bring Rick (the always-on operator) FULLY up on the M1 and make him
# PERSIST. This is not a one-shot boot: it schedules the safe upkeep loop and installs the
# always-on owner-proxy daemon so Rick keeps running the machine on the LOCAL brain and only
# reaches the owner when a human is truly needed. Idempotent — safe to re-run.
# Target is the M1 (macOS); degrades gracefully elsewhere.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RICK=1
MODEL="${RICK_MODEL:-qwen2.5:14b}"
banner(){ printf '\n== %s\n' "$*"; }
ok(){ printf '  ok %s\n' "$*"; }
warn(){ printf '  ! %s\n' "$*"; }

banner "1) Tailscale (mesh online)"
tailscale status >/dev/null 2>&1 && ok "tailscale" || warn "tailscale down — run: tailscale up"

banner "2) Mesh join"
bash "$ROOT/scripts/swarm-join.sh" --name rick 2>/dev/null || bash "$ROOT/scripts/swarm-join.sh" 2>/dev/null || true

banner "3) Local brain (Ollama) + agents"
if command -v ollama >/dev/null; then
  pgrep -f "ollama serve" >/dev/null 2>&1 || (ollama serve >/tmp/rick-ollama.log 2>&1 &)
  sleep 2
  if ollama list 2>/dev/null | grep -qi "${MODEL%%:*}"; then ok "brain serving: $MODEL"; else warn "brain model $MODEL not pulled — run: ollama pull $MODEL"; fi
else
  warn "ollama not installed — run: bash scripts/setup-llm.sh"
fi
if [ -d "$HOME/Projects/AIXMOS-AGENTS" ]; then
  (cd "$HOME/Projects/AIXMOS-AGENTS" && npm install --silent 2>/dev/null; npm start >/tmp/rick-agents.log 2>&1 &)
  sleep 3
  curl -sf http://127.0.0.1:7777/healthz >/dev/null && ok "agents :7777" || warn "agents — see /tmp/rick-agents.log"
else
  warn "clone: git clone https://github.com/AIXMOS537/AIXMOS-AGENTS.git ~/Projects/AIXMOS-AGENTS"
fi

banner "4) HAILMARY (owner-proxy) booted"
bash "$ROOT/scripts/hailmary" booyah 2>/dev/null || true

# ── This is what makes Rick TRULY active instead of merely booted: persist the loops. ──
banner "5) PERSIST — Rick keeps himself running (the part that actually matters)"
if [ "$(uname -s)" = "Darwin" ]; then
  bash "$ROOT/scripts/autopilot.sh" install 2>/dev/null \
    && ok "autopilot LaunchAgent — safe upkeep loop every 3h, auto-restart at login" \
    || warn "autopilot install needs attention: bash scripts/autopilot.sh install"
  bash "$ROOT/scripts/hailmary-autostart.sh" 2>/dev/null \
    && ok "HAILMARY always-on — starts at login, restarts forever (KeepAlive)" \
    || warn "hailmary-autostart needs attention: bash scripts/hailmary-autostart.sh"
else
  warn "not macOS — scheduling the upkeep loop via cron instead"
  bash "$ROOT/scripts/autopilot.sh" install 2>/dev/null || true
fi

banner "RICK IS ACTIVE — and stays active"
cat <<INFO
  He now runs himself on this M1, local-first:
    • autopilot — safe upkeep loop (containment · selftest · sync · health · memory) every 3h
    • HAILMARY  — always-on owner-proxy reasoning on the local brain ($MODEL)
  He escalates ONLY when a human is truly needed — a real failure or a decision.
  Status : cat "$ROOT/.hailmary/autopilot-status"
  Logs   : "$ROOT/.hailmary/autopilot.log"  ·  ~/.hailmary/daemon.out.log
  Pause  : tmmt dark        Resume: tmmt light
  Stop   : bash scripts/autopilot.sh uninstall && bash scripts/hailmary-autostart.sh --uninstall
INFO
