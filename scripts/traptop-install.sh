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

say "  ╔══════════════════════════════════════════════════════╗"
say "  ║   TMMT TRAPTOP INSTALLER — PROJECT X HAILMARY       ║"
say "  ║   Platform: $OS $ARCH"
say "  ╚══════════════════════════════════════════════════════╝"
echo ""
info "This device will be configured as a DORMANT TMMT Traptop."
info "The engine will not start until X activates it with the master keys."
echo ""

# ── 1. CLONE / UPDATE REPO ───────────────────────────────────────────────────────
if [ ! -d "$ROOT/.git" ]; then
  info "Cloning TMMT engine..."
  git clone --depth 1 https://github.com/AIXMOS537/TMMT.git "$ROOT" 2>/dev/null \
  || git clone --depth 1 https://github.com/AIXMOS537/TMMT "$ROOT" 2>/dev/null \
  || { warn "Could not clone — is this device running offline? Copy the repo manually to $ROOT"; }
else
  info "Repo already present at $ROOT — pulling latest..."
  git -C "$ROOT" pull --ff-only 2>/dev/null || true
fi
ok "Repo at $ROOT"

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

if command -v ollama >/dev/null 2>&1; then
  if (( RAM_GB >= 16 )); then
    MODEL="llama3.2:3b"; info "RAM: ${RAM_GB}GB → pulling $MODEL (full)"
  elif (( RAM_GB >= 8 )); then
    MODEL="qwen2.5:1.5b"; info "RAM: ${RAM_GB}GB → pulling $MODEL (standard)"
  else
    MODEL="qwen2.5:0.5b"; info "RAM: ${RAM_GB}GB → pulling $MODEL (lite)"
  fi
  ollama pull "$MODEL" 2>/dev/null && ok "Model $MODEL ready" || warn "Model pull failed — run manually: ollama pull $MODEL"
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
