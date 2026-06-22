#!/usr/bin/env bash
# local-up — run TMMT OS LOCAL, on your own hardware, reachable over the mesh.
# The point: never depend on Vercel's cloud build/deploy quota again. You build
# and serve here; other devices reach it over Tailscale.
#
#   bash scripts/local-up.sh up      build + serve (foreground)
#   bash scripts/local-up.sh serve   serve an existing build (no rebuild)
#   bash scripts/local-up.sh tailnet expose over Tailscale (tailscale serve)
#   bash scripts/local-up.sh down    stop a background serve
#
# Wired into the one-word system: `bash scripts/tmmt local`.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
PIDFILE="$ROOT/.swarm/local-serve.pid"
mkdir -p "$ROOT/.swarm"

have() { command -v "$1" >/dev/null 2>&1; }

tailnet_url() {
  if have tailscale; then
    local host ip
    host="$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/\.$//')"
    ip="$(tailscale ip -4 2>/dev/null | head -1)"
    [ -n "${host:-}" ] && echo "  mesh (MagicDNS): http://${host}:${PORT}"
    [ -n "${ip:-}" ]   && echo "  mesh (tailnet IP): http://${ip}:${PORT}"
  fi
}

check_env() {
  if [ ! -f "$ROOT/.env" ]; then
    printf '⚠️  No .env — the live app needs it. Pull it:\n    vercel env pull .env --environment=production\n'
    printf '   (build/test/lint run fine without it; serving the live app does not.)\n'
  fi
}

case "${1:-up}" in
  up)
    check_env
    echo "▶ building locally (next build)…"
    npm run build || { echo "✗ build failed — fix above, nothing served."; exit 1; }
    echo "▶ serving on ${HOST}:${PORT}"
    tailnet_url
    exec npx next start -H "$HOST" -p "$PORT"
    ;;
  serve)
    check_env
    [ -d "$ROOT/.next" ] || { echo "✗ no .next build — run: bash scripts/local-up.sh up"; exit 1; }
    echo "▶ serving existing build on ${HOST}:${PORT}"
    tailnet_url
    exec npx next start -H "$HOST" -p "$PORT"
    ;;
  bg)
    check_env
    npm run build || { echo "✗ build failed."; exit 1; }
    nohup npx next start -H "$HOST" -p "$PORT" >"$ROOT/.swarm/local-serve.log" 2>&1 &
    echo $! > "$PIDFILE"
    echo "▶ serving in background (pid $(cat "$PIDFILE")), log: .swarm/local-serve.log"
    tailnet_url
    ;;
  tailnet)
    have tailscale || { echo "✗ tailscale not installed."; exit 1; }
    echo "▶ exposing :${PORT} over the tailnet (HTTPS, tailnet-only)…"
    exec tailscale serve --bg "http://127.0.0.1:${PORT}"
    ;;
  down)
    if [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "■ stopped local serve."; rm -f "$PIDFILE"
    else
      echo "nothing to stop (no $PIDFILE)."
    fi
    ;;
  *)
    echo "usage: local-up.sh [up|serve|bg|tailnet|down]"; exit 1;;
esac
