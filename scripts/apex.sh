#!/usr/bin/env bash
# apex — THE sovereign command. Best of the best. Now, forever, always.
#
#   apex              full install (mesh + agents + heal + login hook)
#   apex up           same
#   apex status       one-screen sovereign dashboard
#   apex tick         heal + one forever-loop cycle (runs at login)
#   apex help
#
# Aliases: sovereign · seals (same as forever-up + agent stack)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT"; do
  [[ -f "$d/scripts/tmmt" ]] && ROOT="$d" && break
done
cd "$ROOT"
export TMMT_ROOT="$ROOT"

if [[ -f "$ROOT/scripts/lib/swarm-common.sh" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib/swarm-common.sh" 2>/dev/null || true
fi
type ok >/dev/null 2>&1 || ok(){ printf '  ✓ %s\n' "$*"; }
type warn >/dev/null 2>&1 || warn(){ printf '  ! %s\n' "$*" >&2; }
type say >/dev/null 2>&1 || say(){ printf '%s\n' "$*"; }

QUIET=0
CMD="${1:-up}"
shift || true
[[ "$CMD" == "--quiet" ]] && { QUIET=1; CMD="${1:-tick}"; shift || true; }

apex_up() {
  [[ "$QUIET" -eq 0 ]] && cat <<'BANNER'

   ╔══════════════════════════════════════════════════════════════╗
   ║  A P E X  —  S O V E R E I G N   S T A C K                   ║
   ║  mesh · agents · heal · dispatch · zero typing · forever     ║
   ╚══════════════════════════════════════════════════════════════╝

BANNER

  if [[ -f "$ROOT/.swarm/DARK" ]]; then
    say "⛔ DARK — apex blocked. Lift: bash scripts/godark lift"
    exit 1
  fi

  # Default vault path (Brain) if unset
  if [[ -z "${HAILMARY_VAULT:-}" && -d "$HOME/Brain/vault" ]]; then
    export HAILMARY_VAULT="$HOME/Brain/vault/03-Systems/hailmary-memory"
    mkdir -p "$HAILMARY_VAULT"
    grep -q 'HAILMARY_VAULT' "$HOME/.zshrc" 2>/dev/null || \
      printf '\nexport HAILMARY_VAULT="%s"\n' "$HAILMARY_VAULT" >> "$HOME/.zshrc"
    ok "HAILMARY_VAULT → Brain vault"
  fi

  # Layer 1: TMMT forever mesh (sync · dispatch · router · hailmary)
  bash "$ROOT/scripts/forever-up.sh" 2>/dev/null || bash "$ROOT/scripts/forever-up.sh" carry

  # Layer 2: Project X agent stack (LiteLLM · CCR · OpenClaude)
  if [[ -f "$HOME/Desktop/X-FOREVER/RUN-X-FOREVER.sh" ]]; then
    bash "$HOME/Desktop/X-FOREVER/RUN-X-FOREVER.sh" >/dev/null 2>&1 && ok "X-FOREVER agent stack" || warn "X-FOREVER partial"
  elif [[ -f "$HOME/.config/tmmt/x-forever.sh" ]]; then
    ok "Project X config present (~/.config/tmmt)"
  fi

  # Layer 3: Self-heal + heartbeat watch + login hook
  bash "$ROOT/scripts/mesh/sovereign-heal.sh" 2>/dev/null || true
  bash "$ROOT/scripts/mesh/install-heartbeat-watch.sh" install 2>/dev/null && ok "heartbeat watch (60s)"
  bash "$ROOT/scripts/mesh/install-sovereign-login.sh" install 2>/dev/null && ok "login hook → apex tick"

  # Layer 4: Sovereign env marker (idempotent)
  mkdir -p "$HOME/.config/tmmt"
  cat > "$HOME/.config/tmmt/sovereign.env" <<EOF
# APEX sovereign stack — $(date -u +%Y-%m-%dT%H:%M:%SZ)
TMMT_ROOT="$ROOT"
HAILMARY_VAULT="${HAILMARY_VAULT:-}"
SOVEREIGN_APEX=1
EOF

  # Layer 5: Shell one-word commands
  bash "$ROOT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
  install_shell_words() {
    local rc="$1" tmp mark="# TMMT_APEX"
    [[ -e "$rc" ]] || touch "$rc"
    tmp="$(mktemp)"
    grep -v "$mark" "$rc" | grep -v 'alias apex=' | grep -v 'alias sovereign=' | grep -v 'alias seals=' > "$tmp" 2>/dev/null || true
    {
      echo "$mark"
      echo "alias apex='bash \"$ROOT/scripts/apex.sh\"'"
      echo "alias sovereign='bash \"$ROOT/scripts/apex.sh\"'"
      echo "alias seals='bash \"$ROOT/scripts/apex.sh\"'"
    } >> "$tmp"
    mv "$tmp" "$rc"
  }
  install_shell_words "$HOME/.zshrc"
  ok "shell: apex · sovereign · seals"

  bash "$ROOT/scripts/oneshot-generate.sh" 2>/dev/null || true
  bash "$ROOT/scripts/blip/make-blip-bundle.sh" 2>/dev/null || true
  ok "BLIP bundle + ONE-SHOT refreshed"

  [[ "$QUIET" -eq 0 ]] && cat <<'DONE'

══════════════════════════════════════════════════════════════
  APEX COMPLETE — Navy SEAL team online. You type nothing.
══════════════════════════════════════════════════════════════
  apex status     one screen — daemons · AI · money · inbox
  watchtower      League roster + agent log
  tmmt            owner control board
  hc / forge      local agent (unlimited)
  god on          sovereign Max when you decide

  Owner ping: URGENT/EMERGENCY only.
  Canon: docs/FOREVER-LOOP.md · docs/SOVEREIGN-STACK.md · docs/GO-LIVE-CANON.md
DONE
}

apex_tick() {
  bash "$ROOT/scripts/mesh/sovereign-heal.sh" 2>/dev/null || true
  bash "$ROOT/scripts/mesh/forever-loop.sh" tick 2>/dev/null || true
}

case "$CMD" in
  up|boot|install|"") apex_up ;;
  status|st) exec bash "$ROOT/scripts/mesh/sovereign-status.sh" ;;
  tick|pulse) apex_tick ;;
  help|-h|--help)
    cat <<'HELP'
apex — sovereign stack (best of the best · forever)

  apex            full install — mesh + agents + heal + login
  apex status     daemons · AI · money blockers · inbox
  apex tick       heal + one mesh cycle (runs at login)

Also: sovereign · seals · forever · watchtower · tmmt
HELP
    ;;
  *) apex_up ;;
esac
