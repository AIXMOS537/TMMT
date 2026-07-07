#!/usr/bin/env bash
# autopilot.sh — ONE COMMAND. You are NOT the middleman anymore.
# Local agents (forge/Rick/M1) run free. Claude Max + Cursor = OFF unless YOU type god on.
#
#   bash scripts/autopilot.sh          # full arm tonight
#   bash scripts/autopilot.sh status   # am I out of the loop yet?
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMMT_CFG="$HOME/.config/tmmt"
mkdir -p "$TMMT_CFG"

G=$'\033[32m'; Y=$'\033[33m'; C=$'\033[36m'; B=$'\033[1m'; X=$'\033[0m'
say(){ printf '\n%s▶ %s%s\n' "$C" "$1" "$X"; }
ok(){ printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$X" "$*"; }

print_done() {
  cat <<'DONE'

╔══════════════════════════════════════════════════════════════════╗
║  AUTOPILOT ON — YOU ARE NOT THE ROUTER ANYMORE                   ║
╠══════════════════════════════════════════════════════════════════╣
║  STOP opening Cursor + Claude for every task.                    ║
║                                                                  ║
║  Drop work (voice or text):                                      ║
║    tmmt work "fix the kits page"                                 ║
║    tmmt work "write operator SMS" --money 5                      ║
║                                                                  ║
║  Local code (FREE · unlimited):                                  ║
║    hc ship          heavy build · Moose persona                  ║
║    hc ops           Rick ops · sovereignty                       ║
║    forge status     stack health                                 ║
║                                                                  ║
║  Watch the army:                                                 ║
║    tail -f ~/Projects/TMMT/.swarm/forever-loop.log               ║
║    tmmt rick        inbox status                                 ║
║                                                                  ║
║  Fable/Max ONLY when YOU choose:  god on && hc god               ║
╠══════════════════════════════════════════════════════════════════╣
║  Money (one paste session — then forget):                        ║
║    open -e ~/.config/tmmt/ghl-paste.env                          ║
║    x --money watch    auto-applies when 5 URLs filled            ║
╚══════════════════════════════════════════════════════════════════╝

DONE
}

case "${1:-go}" in
  status)
    bash "$ROOT/scripts/mesh/forever-loop.sh" status 2>/dev/null || true
    bash "$TMMT_CFG/forge.sh" status 2>/dev/null | tail -15 || warn "forge not installed"
    (cd "$ROOT" && npm run ghl:check 2>&1 | grep -E '✓|✗|Result' | head -12) || true
    ;;
  go|"")
    cat <<'BANNER'
╔══════════════════════════════════════════════════════════════════╗
║  AUTOPILOT — local army · $0 marginal · you watch the race       ║
╚══════════════════════════════════════════════════════════════════╝
BANNER

    say "1/6 Protect credits (god OFF · local only)"
    bash "$TMMT_CFG/god-mode.sh" off 2>/dev/null || true
    export LOCAL_FIRST=1
    [[ -x "$ROOT/scripts/mesh/enforce-local-first.sh" ]] \
      && bash "$ROOT/scripts/mesh/enforce-local-first.sh" || true
    ok "Paid APIs off for loops"

    say "2/6 Local brain (Ollama · LiteLLM · forge)"
    if [[ -x "$TMMT_CFG/forge.sh" ]]; then
      bash "$TMMT_CFG/forge.sh" install 2>/dev/null || true
      bash "$TMMT_CFG/forge.sh" status 2>/dev/null | tail -8 || warn "forge partial"
    else
      warn "forge.sh missing — run Desktop/X-FOREVER/RUN-X-FOREVER.sh"
    fi

    say "3/6 Forever daemons (sync · dispatch · probe)"
    bash "$ROOT/scripts/forever-up.sh" carry 2>/dev/null || bash "$ROOT/scripts/mesh/install-forever-loop.sh" install carry 180

    say "4/6 Army live + route work to M1"
    bash "$ROOT/scripts/one-shot-live-forever.sh" 2>/dev/null || true
    bash "$ROOT/scripts/mesh/m1-work-router.sh" route 2>/dev/null || true

    say "5/6 Money prep (webhook auto · checkouts = one paste)"
    bash "$ROOT/scripts/deal.sh" summary 2>/dev/null || true
    if [[ -f "$ROOT/.env.local" ]] && grep -q '^GHL_API_KEY=.\{8,\}' "$ROOT/.env.local" 2>/dev/null; then
      (cd "$ROOT" && npm run ghl:discover 2>/dev/null) || true
    fi

    say "6/6 Drop tonight's master mission"
    bash "$ROOT/scripts/tmmt" work "AUTOPILOT: drain FLEET-INBOX · build TMMT · no paid APIs" --money 5 --emergency 3 2>/dev/null || true

    say "7/7 Empire mesh package + Carry watchtower"
    bash "$ROOT/scripts/install-carry-watchtower.sh" 2>/dev/null || true
    bash "$ROOT/scripts/make-empire-mesh.sh" 2>/dev/null || true

    print_done

    # Background: watch paste file → auto apply when ready
    if [[ "${AUTOPILOT_WATCH_GHL:-1}" == "1" ]] && [[ -x "$ROOT/scripts/ghl-paste-watch.sh" ]]; then
      nohup bash "$ROOT/scripts/ghl-paste-watch.sh" >>"$HOME/Library/Logs/ghl-paste-watch.log" 2>&1 &
      ok "GHL paste watcher running (logs: ~/Library/Logs/ghl-paste-watch.log)"
    fi
    ;;
  *)
    echo "usage: autopilot.sh [go|status]" >&2
    exit 1
    ;;
esac
