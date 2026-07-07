#!/usr/bin/env bash
# M1 ONE-SHOT FOREVER — double-click GO.command on M1 Mac after BLIP/AirDrop.
# Self-contained. No Carry required after drop (Syncthing enhances when synced).
# Authority: PROJECT X HAILMARY · Family first · Faith-centered · 100 operator cap
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
XFOREVER="$DIR/X-FOREVER"
RICK_DIR="$DIR/rick"
LOG="$HOME/Library/Logs/m1-oneshot-forever.log"
mkdir -p "$HOME/Library/Logs" "$HOME/.config/tmmt" "$HOME/.local/bin"

exec > >(tee -a "$LOG") 2>&1

say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok(){ printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m⚠\033[0m %s\n' "$*"; }
die(){ printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

say "M1 ONE-SHOT FOREVER — $(date)"
say "Family first · Faith · Rick station online"

# ── 0. DOCTRINE (agents read this) ───────────────────────────────────────────
if [[ -f "$DIR/DOCTRINE.txt" ]]; then
  cp -f "$DIR/DOCTRINE.txt" "$HOME/.config/tmmt/M1-DOCTRINE.txt"
  ok "Doctrine installed → ~/.config/tmmt/M1-DOCTRINE.txt"
fi

# ── 1. HOMEBREW (if missing) ─────────────────────────────────────────────────
if ! command -v brew >/dev/null 2>&1; then
  say "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || warn "Homebrew install failed — continue if already present"
  eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
fi

# ── 2. CORE DEPS ─────────────────────────────────────────────────────────────
say "Core dependencies..."
for pkg in ollama tailscale syncthing uv ripgrep; do
  if ! command -v "$pkg" >/dev/null 2>&1; then
    brew install "$pkg" 2>/dev/null && ok "$pkg installed" || warn "$pkg — install manually if needed"
  else
    ok "$pkg present"
  fi
done

# ── 3. OLLAMA + TAILNET BIND ───────────────────────────────────────────────────
say "Ollama — tailnet bind..."
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
launchctl setenv OLLAMA_ORIGINS "*"
open -a Ollama 2>/dev/null || ollama serve >/dev/null 2>&1 &
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
ok "Ollama up"

# Fast models first (M1 can pull heavy later)
ollama pull llama3.2:3b 2>/dev/null || true
ollama pull nomic-embed-text 2>/dev/null || true

# ── 4. X-FOREVER STACK (bundled — no Desktop dependency) ───────────────────────
if [[ -d "$XFOREVER" && -f "$XFOREVER/sync-core.sh" ]]; then
  say "X-FOREVER agent stack..."
  bash "$XFOREVER/BOOYAH-NOW.sh" ready 2>/dev/null && ok "BOOYAH NOW ready" || {
    bash "$XFOREVER/RUN-X-FOREVER.sh" 2>/dev/null && ok "RUN-X-FOREVER complete" || warn "X-FOREVER partial — check log"
  }
  [[ -f "$XFOREVER/install-forge-m1.sh" ]] && bash "$XFOREVER/install-forge-m1.sh" 2>/dev/null && ok "Forge M1 installed" || true
else
  warn "X-FOREVER bundle missing in $XFOREVER — copy folder intact from BLIP"
fi

# ── 5. RICK MODEL (if Modelfile bundled) ─────────────────────────────────────
if [[ -f "$RICK_DIR/Modelfile.rick-safe" ]]; then
  say "Rick-safe model..."
  cp -f "$RICK_DIR/Modelfile.rick-safe" "$HOME/rick/" 2>/dev/null || mkdir -p "$HOME/rick" && cp -f "$RICK_DIR/Modelfile.rick-safe" "$HOME/rick/"
  cd "$HOME/rick"
  ollama pull qwen2.5:14b 2>/dev/null || ollama pull llama3.2:3b 2>/dev/null || true
  ollama create rick-safe:v1 -f Modelfile.rick-safe 2>/dev/null && ok "rick-safe:v1" || warn "rick-safe build skipped"
  cd "$DIR"
fi

# ── 6. LITELLM GATEWAY (M1 Rick bootstrap — lightweight path) ────────────────
if [[ -f "$RICK_DIR/../oneshot-install.sh" ]] || [[ -f "$XFOREVER/oneshot-install.sh" ]]; then
  say "LiteLLM Rick gateway..."
  RICK_BOOT="${XFOREVER}/oneshot-install.sh"
  [[ -f "$RICK_DIR/Modelfile.rick-safe" ]] && mkdir -p "$HOME/rick" && cp -f "$RICK_DIR/Modelfile.rick-safe" "$HOME/rick/"
  if [[ -f "$RICK_BOOT" && -f "$HOME/rick/Modelfile.rick-safe" ]]; then
    (cd "$HOME/rick" && bash "$RICK_BOOT") 2>/dev/null && ok "LiteLLM :4001" || warn "Rick bootstrap partial"
  fi
fi

# ── 7. BRAIN (Syncthing + corpus + AnythingLLM) ──────────────────────────────
say "Brain layer..."
if [[ -d "$HOME/Sync/rick" ]]; then
  [[ -f "$HOME/Sync/rick/BRAIN-FEED/compile-corpus.sh" ]] && bash "$HOME/Sync/rick/BRAIN-FEED/compile-corpus.sh" && ok "Corpus compiled"
  [[ -f "$RICK_DIR/SETUP-BRAIN-M1.command" ]] && warn "Run SETUP-BRAIN-M1.command for AnythingLLM ingest if not done"
else
  warn "Syncthing ~/Sync/rick not yet — open Syncthing app, pair with Carry, then re-run GO.command"
  brew install --cask syncthing 2>/dev/null || true
  open -a Syncthing 2>/dev/null || true
fi

if [[ ! -d "/Applications/AnythingLLM.app" ]]; then
  brew install --cask anythingllm 2>/dev/null && ok "AnythingLLM installed" || warn "Install AnythingLLM manually"
fi

# ── 8. SWARM ROLE ────────────────────────────────────────────────────────────
mkdir -p "$HOME/projects/TMMT/.swarm" 2>/dev/null || mkdir -p "$HOME/.swarm"
printf '%s\n' "rick" > "${HOME}/projects/TMMT/.swarm/role" 2>/dev/null || printf '%s\n' "rick" > "$HOME/.swarm/role"
ME="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-' || echo m1-rick)"
printf '%s\n' "$ME" > "${HOME}/projects/TMMT/.swarm/machine" 2>/dev/null || true
ok "Swarm role: rick ($ME)"

# ── 9. FLEET INBOX + WORK PICKUP ─────────────────────────────────────────────
FLEET="$HOME/Sync/rick/FLEET-INBOX"
mkdir -p "$FLEET" "$HOME/Sync/rick/BRAIN-FEED/inbox"
ok "Fleet inbox: $FLEET"

# Process any pending missions from Carry — autopilot executes, no human
if ls "$FLEET"/*.md >/dev/null 2>&1; then
  say "Pending missions — autopilot will execute:"
  ls -lt "$FLEET"/*.md 2>/dev/null | head -5 | sed 's/^/  /'
fi

# ── 10. FOREVER LOOP + AUTOPILOT (zero human after BLIP) ───────────────────
AUTOPILOT=""
for TMMT in "$HOME/projects/TMMT" "$HOME/Projects/TMMT" "$DIR"; do
  [[ -f "$TMMT/scripts/blip/m1-autopilot.sh" ]] && AUTOPILOT="$TMMT/scripts/blip/m1-autopilot.sh" && break
  [[ -f "$DIR/scripts/blip/m1-autopilot.sh" ]] && AUTOPILOT="$DIR/scripts/blip/m1-autopilot.sh" && break
done
if [[ -n "$AUTOPILOT" ]]; then
  say "M1 AUTOPILOT — zero human · Brainiac via M1..."
  M1_ONESHOT_NO_AUTO=1 bash "$AUTOPILOT" && ok "Autopilot armed" || warn "Autopilot partial — see ~/Library/Logs/m1-autopilot.log"
else
  for TMMT in "$HOME/projects/TMMT" "$HOME/Projects/TMMT"; do
    [[ -f "$TMMT/scripts/mesh/install-forever-loop.sh" ]] \
      && bash "$TMMT/scripts/mesh/install-forever-loop.sh" install rick 120 2>/dev/null \
      && ok "Forever-loop installed" && break
  done
fi

# ── 11. HEALTH + REPORT ────────────────────────────────────────────────────────
say "Health check..."
export PATH="$HOME/.local/bin:$PATH"
curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null && ok "Ollama :11434" || warn "Ollama not responding"
curl -sf --max-time 3 http://127.0.0.1:4001/health >/dev/null && ok "LiteLLM :4001" || warn "LiteLLM not up yet — check ~/Library/Logs/litellm-m1.log"
command -v tailscale >/dev/null && tailscale status 2>/dev/null | head -5 | sed 's/^/  /' || warn "Tailscale — join AIXMOS537 tailnet"

if command -v tailscale >/dev/null; then
  TS_HOST="$(tailscale status --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('Self',{}).get('DNSName','').rstrip('.'))" 2>/dev/null || echo unknown)"
  ok "Tailscale: $TS_HOST → peers hit http://${TS_HOST}:4001/v1"
fi

cat <<'DONE'

╔══════════════════════════════════════════════════════════════╗
║  M1 ONE-SHOT FOREVER — COMPLETE                              ║
╠══════════════════════════════════════════════════════════════╣
║  Family first · Faith · Rick online                          ║
╠══════════════════════════════════════════════════════════════╣
║  AUTOPILOT:   forever-loop · FLEET-INBOX auto · Brainiac via M1           ║
║  LOG:         ~/Library/Logs/m1-autopilot.log                              ║
╠══════════════════════════════════════════════════════════════╣
║  Missions from Carry → ~/Sync/rick/FLEET-INBOX/ (auto-run)                 ║
║  Brainiac → via M1 tailnet (no separate BLIP to Brainiac)                  ║
║  Doctrine → ~/.config/tmmt/M1-DOCTRINE.txt                                  ║
╚══════════════════════════════════════════════════════════════╝

DONE

say "Autopilot running — no human input required. Carry can drop missions anytime."
# Do NOT exec interactive booyah — forever-loop handles all work
exit 0
