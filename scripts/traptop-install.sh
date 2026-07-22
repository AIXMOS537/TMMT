#!/usr/bin/env bash
# traptop-install — drops TMMT Traptop onto ANY device (macOS, Linux, Pi).
# X runs this once per device to install the dormant engine + boot agent.
# The engine stays SEALED until traptop-wake.sh is run with the passphrases.
#
#   curl -fsSL <url>/traptop-install.sh | bash   (remote deploy)
#   bash scripts/traptop-install.sh               (local deploy)
#
# Platform support: macOS (Intel/Apple Silicon), Ubuntu/Debian, Raspberry Pi OS
set -uo pipefail
BD=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; X=$'\e[0m'; D=$'\e[2m'
say()  { printf '\n%s%s%s\n' "$BD" "$*" "$X"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$X" "$*"; }
info() { printf '  %s›%s %s\n' "$D" "$X" "$*"; }

OS="$(uname -s)"
ARCH="$(uname -m)"
ROOT="${TMMT_ROOT:-$HOME/Projects/TMMT}"
# Directory this installer lives in — used to find a payload/ bundled beside it
# (USB drop, downloaded kit folder) so no private-repo access is ever required.
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo ".")"

say "  ╔══════════════════════════════════════════════════════╗"
say "  ║   TMMT TRAPTOP INSTALLER — PROJECT X HAILMARY       ║"
say "  ║   Platform: $OS $ARCH"
say "  ╚══════════════════════════════════════════════════════╝"
echo ""
info "This device will be configured as a DORMANT TMMT Traptop."
info "The engine will not start until X activates it with the master keys."
echo ""

# ── 1. CLONE / UPDATE REPO ───────────────────────────────────────────────────────
# PAYLOAD RESOLUTION (2026-07-18) — the old code hard-cloned the PRIVATE repo
# AIXMOS537/TMMT, which no operator can access: it always failed with a confusing
# git error. Resolve a payload from whatever the operator actually has, in order,
# and if none is available continue in STANDALONE mode — the local-AI stack (the
# real product value) does not depend on the repo at all.
STANDALONE=0
if [ -d "$ROOT/.git" ]; then
  info "Engine already present at $ROOT — updating…"
  git -C "$ROOT" pull --ff-only 2>/dev/null || info "(offline or detached — keeping what's here)"
  ok "Engine at $ROOT"
elif [ -n "${TRAPTOP_PAYLOAD_DIR:-}" ] && [ -d "$TRAPTOP_PAYLOAD_DIR" ]; then
  info "Installing from local payload: $TRAPTOP_PAYLOAD_DIR"
  mkdir -p "$ROOT" && cp -R "$TRAPTOP_PAYLOAD_DIR/." "$ROOT/" && ok "Engine installed from local payload"
elif [ -d "$SELF_DIR/payload" ]; then
  info "Installing from payload beside this installer…"
  mkdir -p "$ROOT" && cp -R "$SELF_DIR/payload/." "$ROOT/" && ok "Engine installed from bundled payload"
elif [ -n "${TRAPTOP_PAYLOAD_URL:-}" ]; then
  info "Downloading payload…"
  mkdir -p "$ROOT"
  if curl -fsSL "$TRAPTOP_PAYLOAD_URL" | tar -xz -C "$ROOT" 2>/dev/null; then
    ok "Engine installed from $TRAPTOP_PAYLOAD_URL"
  else
    warn "Payload download failed — continuing in standalone mode"; STANDALONE=1
  fi
elif [ -n "${TRAPTOP_REPO:-}" ]; then
  info "Cloning $TRAPTOP_REPO…"
  git clone --depth 1 "$TRAPTOP_REPO" "$ROOT" 2>/dev/null \
    && ok "Engine cloned" \
    || { warn "Clone failed — continuing in standalone mode"; STANDALONE=1; }
else
  STANDALONE=1
fi

if [ "$STANDALONE" = "1" ]; then
  mkdir -p "$ROOT"
  info "STANDALONE mode — no engine payload supplied."
  info "Local AI still installs fully; this device works offline and private."
  info "To add the engine later, re-run with ONE of:"
  info "  TRAPTOP_PAYLOAD_DIR=/path/to/payload  bash traptop-install.sh"
  info "  TRAPTOP_PAYLOAD_URL=https://…/payload.tar.gz  bash traptop-install.sh"
fi

# ── 2. DEPENDENCIES (Ollama + openssl) ──────────────────────────────────────────
info "Checking dependencies..."
command -v openssl >/dev/null 2>&1 && ok "openssl present" || {
  warn "openssl missing — installing..."
  if [[ "$OS" == "Darwin" ]]; then brew install openssl 2>/dev/null || true
  elif command -v apt-get >/dev/null 2>&1; then sudo apt-get install -y openssl 2>/dev/null || true
  fi
}

if ! command -v ollama >/dev/null 2>&1; then
  info "Installing Ollama (local AI brain)..."
  if [[ "$OS" == "Darwin" ]]; then
    brew install ollama 2>/dev/null \
    || curl -fsSL https://ollama.com/install.sh | sh 2>/dev/null || true
  else
    curl -fsSL https://ollama.com/install.sh | sh 2>/dev/null || true
  fi
  command -v ollama >/dev/null 2>&1 && ok "Ollama installed" || warn "Ollama not installed — manual step needed"
else
  ok "Ollama present"
fi

# ── 3. PULL LOCAL MODEL (by RAM) ─────────────────────────────────────────────────
RAM_GB=4
if [[ "$OS" == "Darwin" ]]; then
  RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 4294967296) / 1073741824 ))
elif [ -f /proc/meminfo ]; then
  RAM_GB=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1048576 ))
fi

# ── AIXMOS TIER MATRIX (2026-07-18) ──────────────────────────────────────────
# Old logic handed every machine >=16GB the same llama3.2:3b (2GB, Sept 2024) —
# so a 64GB workstation ran the same brain as a netbook. Tier by real capacity.
# First pull stays modest so setup finishes fast; the rest of the tier stack is
# recorded to ~/.aixmos/tier.env and fetched later by `traptop upgrade`.
if command -v ollama >/dev/null 2>&1; then
  if   (( RAM_GB >= 96 )); then TIER="T4-BEAST"; MODEL="qwen3.6:27b"; FULL="gpt-oss:20b gemma4:12b qwen3.5:4b"
  elif (( RAM_GB >= 48 )); then TIER="T3-POWER"; MODEL="gpt-oss:20b"; FULL="qwen3.6:27b gemma4:12b qwen3.5:4b"
  elif (( RAM_GB >= 32 )); then TIER="T2-PRO";   MODEL="gpt-oss:20b"; FULL="gemma4:12b qwen3.5:4b"
  elif (( RAM_GB >= 16 )); then TIER="T1-STD";   MODEL="qwen3.5:9b";  FULL="qwen3.5:4b"
  elif (( RAM_GB >= 8  )); then TIER="T0-LITE";  MODEL="qwen3.5:4b";  FULL=""
  else                          TIER="T0-MICRO"; MODEL="qwen3.5:2b";  FULL=""
  fi
  info "RAM: ${RAM_GB}GB → tier ${TIER} → primary model ${MODEL}"
  ollama pull "$MODEL" 2>/dev/null && ok "Model $MODEL ready" || warn "Model pull failed — run manually: ollama pull $MODEL"
  mkdir -p "$HOME/.aixmos"
  printf 'TIER=%s\nRAM_GB=%s\nPRIMARY=%s\nFULL_STACK=%s\n' \
    "$TIER" "$RAM_GB" "$MODEL" "$FULL" > "$HOME/.aixmos/tier.env"
  [ -n "$FULL" ] && info "Tier stack queued (run 'traptop upgrade'): $FULL"
fi

# ── 4. MAKE SCRIPTS EXECUTABLE ───────────────────────────────────────────────────
chmod +x "$ROOT/scripts/"*.sh 2>/dev/null || true
chmod +x "$ROOT/scripts/traptop-seal.sh" "$ROOT/scripts/traptop-wake.sh" 2>/dev/null || true
ok "Scripts executable"

# ── 5. INSTALL BOOT AGENT ────────────────────────────────────────────────────────
if [[ "$OS" == "Darwin" ]]; then
  PLIST_SRC="$ROOT/infra/com.projectx.traptop-boot.plist"
  PLIST_DST="$HOME/Library/LaunchAgents/com.projectx.traptop-boot.plist"
  if [ -f "$PLIST_SRC" ]; then
    # sed in the correct ROOT path
    sed "s|~/Projects/TMMT|$ROOT|g" "$PLIST_SRC" > "$PLIST_DST"
    launchctl load "$PLIST_DST" 2>/dev/null || true
    ok "Boot agent installed (LaunchAgent)"
  fi
elif command -v systemctl >/dev/null 2>&1; then
  # Linux/Pi: create systemd user service
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/traptop-boot.service" <<EOF
[Unit]
Description=TMMT Traptop Boot Agent — PROJECT X HAILMARY
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'if [ -f $ROOT/.aixmos/sealed/.dormant ]; then bash $ROOT/scripts/traptop-wake.sh status; else bash $ROOT/scripts/go 2>/dev/null; fi'
RemainAfterExit=no

[Install]
WantedBy=default.target
EOF
  systemctl --user enable traptop-boot.service 2>/dev/null || true
  ok "Boot agent installed (systemd user service)"
fi

# ── 6. CREATE DORMANT STATE ───────────────────────────────────────────────────────
mkdir -p "$ROOT/.aixmos/sealed"
touch "$ROOT/.aixmos/sealed/.dormant"
chmod 600 "$ROOT/.aixmos/sealed/.dormant"
ok "Dormant flag set — engine will not start until X activates"

# ── 7. ADD ONE-WORD LAUNCH COMMANDS ──────────────────────────────────────────────
if [[ "$OS" == "Darwin" ]] || [[ "$OS" == "Linux" ]]; then
  SHELL_RC="$HOME/.zshrc"
  [[ "$SHELL" == *"bash"* ]] && SHELL_RC="$HOME/.bashrc"
  grep -q "traptop-wake" "$SHELL_RC" 2>/dev/null || cat >> "$SHELL_RC" <<EOF

# TMMT Traptop — PROJECT X HAILMARY
alias wake='bash $ROOT/scripts/traptop-wake.sh wake'
alias dark='bash $ROOT/scripts/traptop-wake.sh sleep'
alias traptop='bash $ROOT/scripts/traptop-wake.sh status'
alias fatherbox='bash $ROOT/scripts/fatherbox'
alias motherbox='bash $ROOT/scripts/motherbox'
EOF
  ok "Aliases added: wake / dark / traptop / fatherbox / motherbox"
fi

# ── DONE ─────────────────────────────────────────────────────────────────────────
echo ""
say "  ╔══════════════════════════════════════════════════════╗"
say "  ║   ✓  TMMT TRAPTOP INSTALLED — ENGINE DORMANT        ║"
say "  ║                                                      ║"
say "  ║   Next for X:                                        ║"
say "  ║   1. bash scripts/traptop-seal.sh pack              ║"
say "  ║   2. bash scripts/traptop-seal.sh seal              ║"
say "  ║      (set 3-5 master passphrases)                   ║"
say "  ║   3. Ship the device.                               ║"
say "  ║                                                      ║"
say "  ║   To activate (operator runs):                      ║"
say "  ║      wake   (then X speaks the keys remotely)       ║"
say "  ╚══════════════════════════════════════════════════════╝"
echo ""
