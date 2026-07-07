#!/usr/bin/env bash
# everything.sh — PROJECT X HAILMARY
# ONE command. Arms any machine completely.
#
# Usage:
#   bash scripts/everything.sh                        # arm THIS machine
#   bash scripts/everything.sh --team <name> <role>   # provision team member
#   bash scripts/everything.sh --operator <name> <tier> [key]  # provision operator
#   bash scripts/everything.sh --status               # fleet health check
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BD=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; R=$'\e[31m'; RST=$'\e[0m'
ok()   { printf '  %s✓%s %s\n' "$G" "$RST" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$RST" "$*"; }
err()  { printf '  %sX%s %s\n' "$R" "$RST" "$*"; }
say()  { printf '\n%s%s%s\n'   "$BD" "$*"  "$RST"; }
info() { printf '  %s›%s %s\n' "$C" "$RST" "$*"; }

# ── Fleet status ──────────────────────────────────────────
if [[ "${1:-}" == "--status" ]]; then
  say "Fleet Health"
  echo "  Machine : $(hostname)"
  echo "  User    : $(whoami)"
  echo "  OS      : $(uname -srm)"
  echo "  Git     : $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  echo "  ARIA    : $(curl -s --max-time 2 http://localhost:4200 >/dev/null 2>&1 && echo 'UP :4200' || echo 'DOWN')"
  echo "  Ollama  : $(curl -s --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1 && echo 'UP :11434' || echo 'DOWN')"
  echo "  Face srv: $(curl -s --max-time 2 http://localhost:7788/health >/dev/null 2>&1 && echo 'UP :7788' || echo 'DOWN')"
  echo "  Tailscale: $(tailscale status --json 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("BackendState","unknown"))' 2>/dev/null || echo 'unknown')"
  firewall_status=$(defaults read /Library/Preferences/com.apple.alf globalstate 2>/dev/null || echo '?')
  echo "  Firewall: $([[ "$firewall_status" == "1" || "$firewall_status" == "2" ]] && echo 'ON' || echo 'OFF')"
  exit 0
fi

# ── Team provision ────────────────────────────────────────
if [[ "${1:-}" == "--team" ]]; then
  NAME="${2:-}"; ROLE="${3:-ops}"
  [[ -z "$NAME" ]] && { err "Usage: $0 --team <name> <role>"; exit 1; }
  bash "$ROOT/scripts/fleet/team-provision.sh" "$NAME" "$ROLE"
  exit 0
fi

# ── Operator provision ────────────────────────────────────
if [[ "${1:-}" == "--operator" ]]; then
  NAME="${2:-}"; TIER="${3:-TASTE}"; KEY="${4:-}"
  [[ -z "$NAME" ]] && { err "Usage: $0 --operator <name> <tier> [key]"; exit 1; }
  bash "$ROOT/scripts/fleet/operator-provision.sh" "$NAME" "$TIER" "$KEY"
  exit 0
fi

# ── ARM THIS MACHINE ──────────────────────────────────────
clear
printf '\n%s╔══════════════════════════════════════════════════════╗%s\n' "$C" "$RST"
printf '%s║   PROJECT X HAILMARY — EVERYTHING                  ║%s\n' "$C" "$RST"
printf '%s║   One command. Full fleet.                          ║%s\n' "$C" "$RST"
printf '%s╚══════════════════════════════════════════════════════╝%s\n\n' "$C" "$RST"

# ── STEP 1: Firewall ─────────────────────────────────────
say "STEP 1 — Firewall + Lockdown"
if [[ "$(uname)" == "Darwin" ]]; then
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on >/dev/null 2>&1 && ok "Firewall ON" || warn "Firewall already on or needs sudo"
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on >/dev/null 2>&1 && ok "Stealth mode ON"
  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setloggingmode on >/dev/null 2>&1 && ok "Logging ON"
  # SSH off
  sudo systemsetup -f -setremotelogin off >/dev/null 2>&1 && ok "SSH OFF" || true
  # AirDrop — nobody
  defaults write com.apple.NetworkBrowser DisableAirDrop -bool YES 2>/dev/null && ok "AirDrop disabled" || true
  # FileVault check (never disable — just warn if off)
  fv=$(fdesetup status 2>/dev/null)
  [[ "$fv" == *"On"* ]] && ok "FileVault ON" || warn "FileVault OFF — enable in System Preferences"
  ok "macOS lockdown done"
else
  warn "Non-macOS detected — skip OS lockdown (run fleet/personal-win-lockdown.ps1 on Windows)"
fi

# ── STEP 2: Homebrew + deps ──────────────────────────────
say "STEP 2 — Homebrew + Dependencies"
if ! command -v brew >/dev/null 2>&1; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>/dev/null
fi
ok "Homebrew $(brew --version 2>/dev/null | head -1)"
for pkg in git node python3 ffmpeg; do
  command -v "$pkg" >/dev/null 2>&1 && ok "$pkg present" || { info "Installing $pkg..."; brew install "$pkg" 2>/dev/null && ok "$pkg installed"; }
done

# ── STEP 3: Ollama ───────────────────────────────────────
say "STEP 3 — Ollama (local AI)"
if ! command -v ollama >/dev/null 2>&1; then
  info "Installing Ollama..."
  brew install ollama 2>/dev/null && ok "Ollama installed" || warn "Install manually: https://ollama.ai"
fi
if command -v ollama >/dev/null 2>&1; then
  pgrep -x ollama >/dev/null 2>&1 || { ollama serve &>/dev/null & sleep 2; }
  RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 8589934592) / 1073741824 ))
  if   [[ $RAM_GB -ge 32 ]]; then MODEL="qwen2.5:14b"
  elif [[ $RAM_GB -ge 16 ]]; then MODEL="qwen2.5:7b"
  elif [[ $RAM_GB -ge 8  ]]; then MODEL="llama3.2:3b"
  else                              MODEL="llama3.2:1b"; fi
  ollama list 2>/dev/null | grep -q "${MODEL%%:*}" && ok "Ollama model $MODEL present" || {
    info "Pulling $MODEL (this takes a few minutes on first run)..."
    ollama pull "$MODEL" 2>/dev/null && ok "$MODEL ready" || warn "Pull failed — Ollama running: check ollama status"
  }
fi

# ── STEP 3.5: Face + Voice stack ─────────────────────────
say "STEP 3.5 — ARIA Face + Voice Stack"
FACE_DIR="$ROOT/.aixmos/face"
if [[ ! -d "$FACE_DIR/venv" ]]; then
  info "Installing face + voice stack (first time ~10 min)..."
  bash "$ROOT/scripts/aria-face-setup.sh" 2>/dev/null && ok "Face + voice stack installed" || warn "Setup face later: bash scripts/aria-face-setup.sh"
else
  ok "Face + voice stack present"
  curl -s --max-time 2 http://localhost:7788/health >/dev/null 2>&1 && ok "Face server running :7788" || {
    info "Starting face server..."
    source "$FACE_DIR/venv/bin/activate" 2>/dev/null || true
    nohup python3 "$FACE_DIR/aria_face_server.py" >"${HOME}/.config/tmmt/logs/aria-face.log" 2>&1 &
    sleep 3
    curl -s --max-time 3 http://localhost:7788/health >/dev/null 2>&1 && ok "Face server up :7788" || warn "Face server starting..."
    deactivate 2>/dev/null || true
  }
fi

# ── STEP 4: ARIA ─────────────────────────────────────────
say "STEP 4 — ARIA (local AI brain)"
ARIA_DIR="$ROOT/aria"
if [[ ! -f "$ARIA_DIR/package.json" ]]; then
  warn "aria/ not found — skipping (repo may need pull)"
else
  if [[ ! -d "$ARIA_DIR/node_modules" ]]; then
    info "Installing ARIA dependencies..."
    cd "$ARIA_DIR" && npm install --silent 2>/dev/null && cd "$ROOT" && ok "ARIA deps installed"
  fi
  if [[ ! -d "$ARIA_DIR/.next" ]]; then
    info "Building ARIA..."
    cd "$ARIA_DIR" && npm run build 2>/dev/null | tail -3 && cd "$ROOT" && ok "ARIA built"
  fi
  # LaunchAgent
  PLIST="$HOME/Library/LaunchAgents/com.aixmos.aria.plist"
  if [[ ! -f "$PLIST" ]]; then
    bash "$ROOT/scripts/fleet/aria-launchagent-install.sh" 2>/dev/null && ok "ARIA LaunchAgent installed" || warn "Run: bash scripts/fleet/aria-launchagent-install.sh"
  else
    launchctl kickstart -k "gui/$(id -u)/com.aixmos.aria" 2>/dev/null || true
    sleep 3
    curl -s --max-time 5 http://localhost:4200 >/dev/null 2>&1 && ok "ARIA running at http://localhost:4200" || warn "ARIA starting — check: launchctl list | grep aria"
  fi
fi

# ── STEP 5: RUBIK secrets engine ─────────────────────────
say "STEP 5 — RUBIK Secrets Engine"
ROTATE="$HOME/.config/tmmt/rotate.sh"
if [[ -f "$ROTATE" ]]; then
  ok "RUBIK rotate.sh present"
  PLIST_RUBIK="$HOME/Library/LaunchAgents/com.aixmos.rubik.plist"
  launchctl list 2>/dev/null | grep -q "rubik" && ok "RUBIK LaunchAgent running" || {
    [[ -f "$PLIST_RUBIK" ]] && launchctl bootstrap "gui/$(id -u)" "$PLIST_RUBIK" 2>/dev/null && ok "RUBIK armed" || warn "RUBIK plist not found — run scripts/rubik-setup.sh"
  }
else
  warn "RUBIK not configured — run: bash ~/.config/tmmt/setup-rubik.sh"
fi

# ── STEP 6: Guardian (iMessage watcher) ──────────────────
say "STEP 6 — Hailmary Guardian"
GUARDIAN_PLIST="$HOME/Library/LaunchAgents/com.hailmary.guardian.plist"
if [[ -f "$GUARDIAN_PLIST" ]]; then
  launchctl list 2>/dev/null | grep -q "hailmary.guardian" && ok "Guardian running" || {
    launchctl bootstrap "gui/$(id -u)" "$GUARDIAN_PLIST" 2>/dev/null && ok "Guardian armed" || warn "Guardian needs Full Disk Access — System Prefs → Privacy → Full Disk Access → Terminal"
  }
else
  warn "Guardian not installed — run: bash ~/.config/tmmt/guardian-setup.sh"
fi

# ── STEP 7: Syncthing ────────────────────────────────────
say "STEP 7 — Syncthing mesh sync"
if command -v syncthing >/dev/null 2>&1; then
  pgrep -x syncthing >/dev/null 2>&1 && ok "Syncthing running" || {
    info "Starting Syncthing..."
    nohup syncthing --no-browser >/dev/null 2>&1 &
    sleep 2 && ok "Syncthing started"
  }
else
  warn "Syncthing not installed — brew install syncthing"
fi

# ── STEP 8: Tailscale ────────────────────────────────────
say "STEP 8 — Tailscale mesh"
if command -v tailscale >/dev/null 2>&1; then
  TS_STATE=$(tailscale status --json 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("BackendState",""))' 2>/dev/null || echo "")
  [[ "$TS_STATE" == "Running" ]] && ok "Tailscale running ($(tailscale ip -4 2>/dev/null || echo 'no IP yet'))" || warn "Tailscale not connected — run: tailscale up"
else
  warn "Tailscale not installed — brew install tailscale"
fi

# ── STEP 9: Local-first routing + self-running loops (best mode) ──
say "STEP 9 — Local-first routing + self-running loops"
# Route all agents/loops through the local brain-router: local is free, cloud is
# cheapest-first overflow only (docs/EMPLOYEE-FLEET.md). Best-effort, non-blocking.
if command -v litellm >/dev/null 2>&1; then
  pgrep -f 'litellm --config' >/dev/null 2>&1 \
    || ( nohup bash "$ROOT/scripts/brain-router.sh" >/tmp/brain-router.log 2>&1 & )
  sleep 2; ok "brain-router (local primary) → :4000  (log: /tmp/brain-router.log)"
else
  warn "brain-router needs LiteLLM once: pipx install 'litellm[proxy]'  (then agents route local/free)"
fi
# Persist the always-on employee loops — OWNER nodes only (owner-proxy is owner-only).
if [[ "${RICK:-}" == "1" || "${AIXMOS_OWNER_NODE:-}" == "1" ]] && [[ "$(uname)" == "Darwin" ]]; then
  bash "$ROOT/scripts/office-up-rick.sh" >/dev/null 2>&1 \
    && ok "employee loops persisted — autopilot + always-on HAILMARY, login-boot" \
    || warn "run once: bash scripts/office-up-rick.sh"
else
  info "Always-on employee node?  AIXMOS_OWNER_NODE=1 bash scripts/office-up-rick.sh   (owner nodes only)"
fi

# ── Done ──────────────────────────────────────────────────
printf '\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$G" "$RST"
printf '%s  Machine armed. PROJECT X HAILMARY is live.%s\n' "$G" "$RST"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n' "$G" "$RST"
printf '  ARIA          → http://localhost:4200\n'
printf '  Face server   → http://localhost:7788/health\n'
printf '  Ollama        → http://localhost:11434\n'
printf '  Brain router  → http://localhost:4000  (local-first; cloud = cheap overflow only)\n'
printf '  Employee fleet→ docs/EMPLOYEE-FLEET.md   ·   Status → bash scripts/everything.sh --status\n\n'
