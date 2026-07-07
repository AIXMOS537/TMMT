#!/usr/bin/env bash
# ONE-SHOT-FOREVER.sh — run once per device. Stays alive forever via forever-loop.
# Authority: PROJECT X HAILMARY · v3 · 100 operator cap
#
# Usage:
#   bash scripts/one-shot-forever.sh              # auto-detect role
#   bash scripts/one-shot-forever.sh carry        # Watchtower (Carry M5)
#   bash scripts/one-shot-forever.sh rick         # M1 Max
#   bash scripts/one-shot-forever.sh brain        # Brainiac Windows (run via Git Bash/WSL)
#   bash scripts/one-shot-forever.sh forge        # any build Mac
#
set -uo pipefail

ROLE="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMMT_CFG="${TMMT_CFG:-$HOME/.config/tmmt}"
SYNC_RICK="$HOME/Sync/rick"

say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }
warn(){ printf '  ⚠ %s\n' "$*"; }

# Auto-detect role from hostname
if [[ -z "$ROLE" ]]; then
  H="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  case "$H" in
    *macbook-pro-2*|*carry*) ROLE=carry ;;
    *brainiac*) ROLE=brain ;;
    *m1*|*rick*) ROLE=rick ;;
    *) ROLE=forge ;;
  esac
fi

say "ONE-SHOT FOREVER · role=$ROLE · $(date)"
say "TMMT v3 · 100 operators max · agentic army online"

# ── 1. BRAIN CORPUS (all Macs) ─────────────────────────────────────────────
if [[ -f "$SYNC_RICK/BRAIN-FEED/compile-corpus.sh" ]]; then
  bash "$SYNC_RICK/BRAIN-FEED/compile-corpus.sh" && ok "Brain corpus compiled ($(wc -l < "$SYNC_RICK/BRAIN-FEED/compiled/_MANIFEST.md" 2>/dev/null || echo '?') files)"
else
  warn "Syncthing ~/Sync/rick not ready — sync first"
fi

# ── 2. X-FOREVER / FORGE STACK (Mac) ─────────────────────────────────────────
if [[ "$OSTYPE" == darwin* ]]; then
  for XF in "$HOME/Desktop/X-FOREVER/RUN-X-FOREVER.sh" "$SYNC_RICK/../BLIP-DROP/LATEST/X-FOREVER/RUN-X-FOREVER.sh"; do
    [[ -f "$XF" ]] && { bash "$XF" 2>/dev/null && ok "X-FOREVER stack" && break; }
  done
  [[ -x "$TMMT_CFG/x-forever.sh" ]] && bash "$TMMT_CFG/x-forever.sh" status 2>/dev/null | head -20
fi

# ── 3. ROLE-SPECIFIC BRING-UP ────────────────────────────────────────────────
case "$ROLE" in
  carry)
    ok "Watchtower — command center"
    bash "$ROOT/scripts/mesh/go-live-device.sh" --role carry 2>/dev/null || true
    bash "$ROOT/scripts/mesh/install-forever-loop.sh" carry 2>/dev/null || true
    say "Run ads → tmmt-ops.vercel.app/lp/aixmos/lead-magnet"
    say "Recruit operators → tmmt-ops.vercel.app/join (cap: 100)"
    ;;
  rick|forge|m1)
    ok "M1 / Forge — Rick station + content"
    [[ -f "$SYNC_RICK/SETUP-BRAIN-M1.command" ]] && say "Double-click: ~/Sync/rick/SETUP-BRAIN-M1.command"
    [[ -f "$HOME/Desktop/X-FOREVER/install-forge-m1.sh" ]] && bash "$HOME/Desktop/X-FOREVER/install-forge-m1.sh" 2>/dev/null || true
    bash "$ROOT/scripts/mesh/go-live-device.sh" --role forge 2>/dev/null || true
    ;;
  brain)
    ok "Brainiac — always-on gateway"
    say "Windows: run SETUP-BRAIN-BRAINIAC.ps1 from ~/Sync/rick/"
    say "Docker: cd C:\\hailmary\\brainiac-litellm-gateway && docker compose up -d"
    say "Fallback when Carry offline: http://brainiac-7.tailceb455.ts.net:4000/v1"
    ;;
  *)
    bash "$ROOT/scripts/mesh/go-live-device.sh" --role "$ROLE" 2>/dev/null || true
    ;;
esac

# ── 4. FOREVER LOOP (daemon) ─────────────────────────────────────────────────
if [[ -x "$ROOT/scripts/mesh/install-forever-loop.sh" ]]; then
  bash "$ROOT/scripts/mesh/install-forever-loop.sh" "$ROLE" 2>/dev/null && ok "Forever-loop installed ($ROLE)"
fi

# ── 5. AGENT ARMY STATUS ─────────────────────────────────────────────────────
say "AGENT ARMY — who does what"
cat <<'ARMY'
  Rick        Ops / sovereignty / owner shield
  Chummo      Customer SMS drafts + follow-up
  Moose       Heavy code + content ship
  Vision      Strategy + vertical expansion
  Aida        Ad tenant AI (aixmos org)
  Taj         TMMT vertical AI (when fleet live)
  Forge       OpenClaude → LiteLLM (unlimited local)
  HAILMARY    Watchtower — YOU ONLY (Fable 5 / god on)
ARMY

# ── 6. DEVICE MESH ───────────────────────────────────────────────────────────
if command -v tailscale >/dev/null 2>&1; then
  say "Tailnet nodes (confirm all yours):"
  tailscale status 2>/dev/null | head -10 || true
fi

say "ONE-SHOT COMPLETE — forever-loop keeps this alive"
say "Full map: $ROOT/docs/ONE-SHOT-FOREVER.md"
say "v3 soft launch: $ROOT/docs/TMMT-V3-SOFT-LAUNCH.md"
say "Operator cap: 100 lifetime · join → auto-provision → earn 30%"
