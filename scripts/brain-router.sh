#!/usr/bin/env bash
# brain-router — run a LiteLLM router: LOCAL models primary, ONE legit cloud key as
# optional overflow. The legit "many models behind one endpoint" — NOT key pooling.
#
#   bash scripts/brain-router.sh           start the router on :4000
#   bash scripts/tmmt brain router         (one-word system)
#
# Safe: honors DARK; binds for the tailnet only; never installs without telling you;
# the cloud key (if used) is read from the environment, never stored here.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
CFG="${BRAIN_ROUTER_CONFIG:-$ROOT/tools/brain/litellm.config.yaml}"
PORT="${BRAIN_ROUTER_PORT:-4000}"
# CONTAINMENT: bind to the Tailscale IP if up, else 127.0.0.1. Never 0.0.0.0 — the
# router must not listen on all interfaces / face the public internet.
if [ -n "${BRAIN_ROUTER_HOST:-}" ]; then HOST="$BRAIN_ROUTER_HOST"
elif command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  HOST="$(tailscale ip -4 2>/dev/null | head -1)"; HOST="${HOST:-127.0.0.1}"
else HOST="127.0.0.1"; fi

[ -f "$ROOT/.swarm/DARK" ] && { echo "⛔ DARK — router blocked. Lift: bash scripts/godark lift"; exit 1; }
[ -f "$CFG" ] || { echo "✗ config not found: $CFG"; exit 1; }

echo "  🔀  BRAIN ROUTER (LiteLLM) — local primary + optional 1-key overflow"
echo "      config: $CFG"

# Local brain should be up (the router proxies it).
command -v ollama >/dev/null 2>&1 && ( OLLAMA_HOST=127.0.0.1:11434 ollama serve >/dev/null 2>&1 & ) 2>/dev/null || \
  echo "  • ollama not detected — install the local brain first: bash scripts/tmmt brain"

# LiteLLM must be present — we DON'T auto-install (your machine, your call).
if ! command -v litellm >/dev/null 2>&1; then
  echo "  ✗ litellm not installed. Install once (owner's choice of tool):"
  echo "      pipx install 'litellm[proxy]'     # recommended (isolated)"
  echo "      # or: pip install 'litellm[proxy]'"
  exit 1
fi

# Show where the mesh should point.
if command -v tailscale >/dev/null 2>&1; then
  ip="$(tailscale ip -4 2>/dev/null | head -1)"
  [ -n "$ip" ] && echo "  ✓ point devices/agents at:  POCKET_BRAIN_URL=http://${ip}:${PORT}/v1/chat/completions   (model: code|chat)"
fi
echo "  ⚠ tailnet-only — never expose port ${PORT} to the public internet."
echo "  › starting router on ${HOST}:${PORT} … (Ctrl-C to stop)"
exec litellm --config "$CFG" --host "$HOST" --port "$PORT"
