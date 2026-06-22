#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — MACHINE SCANNER
# Run this on any target machine to get a full intel report
# before activation. Outputs a brief PROJECT X HAILMARY reads first.
# ============================================================

set -euo pipefail

REPORT_FILE="$HOME/Desktop/HAILMARY-SCAN-$(hostname)-$(date +%Y%m%d-%H%M%S).txt"

divider() { printf '%0.s—' {1..60}; echo; }

echo "Scanning machine... this takes about 30 seconds."
echo

{
echo "PROJECT X HAILMARY — MACHINE INTEL REPORT"
echo "Scanned: $(date)"
echo "Target: $(hostname)"
divider

# ── IDENTITY ──────────────────────────────────────────────
echo "MACHINE IDENTITY"
divider
echo "Hostname:        $(hostname)"
echo "macOS Version:   $(sw_vers -productVersion 2>/dev/null || echo 'N/A')"
echo "Chip:            $(sysctl -n machdep.cpu.brand_string 2>/dev/null || uname -m)"
echo "RAM:             $(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f GB", $1/1073741824}' || echo 'N/A')"
echo "Serial:          $(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial/ {print $NF}' | head -1)"
echo "Disk Free:       $(df -h ~ | awk 'NR==2{print $4}') available"
echo "Current User:    $(whoami)"
echo

# ── NETWORK ───────────────────────────────────────────────
echo "NETWORK"
divider
echo "Local IP:        $(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 'N/A')"
echo "Tailscale IP:    $(tailscale ip 2>/dev/null | head -1 || echo 'Not installed')"
echo "Tailscale Status:$(tailscale status 2>/dev/null | head -2 || echo 'Not installed')"
echo

# ── WHAT'S ALREADY INSTALLED ──────────────────────────────
echo "INSTALLED TOOLS (relevant)"
divider

check_tool() {
  local name="$1" cmd="$2"
  if command -v "$cmd" &>/dev/null; then
    echo "$name: INSTALLED ($(command -v "$cmd"))"
  else
    echo "$name: NOT INSTALLED"
  fi
}

check_tool "Homebrew"     "brew"
check_tool "Node.js"      "node"
check_tool "Python3"      "python3"
check_tool "Git"          "git"
check_tool "Ollama"       "ollama"
check_tool "Claude Code"  "claude"
check_tool "Tailscale"    "tailscale"
check_tool "curl"         "curl"
check_tool "jq"           "jq"
check_tool "Docker"       "docker"
echo

# ── OLLAMA MODELS ─────────────────────────────────────────
echo "OLLAMA MODELS ON THIS MACHINE"
divider
if command -v ollama &>/dev/null; then
  ollama list 2>/dev/null || echo "(none or ollama not running)"
else
  echo "Ollama not installed"
fi
echo

# ── EXISTING TMMT / AIXMOS FILES ─────────────────────────
echo "TMMT / AIXMOS FILES FOUND"
divider
find "$HOME" -maxdepth 4 \( \
  -name "*.sh" -o -name "*.command" -o -name "*.bat" -o \
  -name "TMMT*" -o -name "aixmos*" -o -name "hailmary*" -o \
  -name "HAILMARY*" -o -name "brainiac*" -o -name "BRAINIAC*" \
  \) 2>/dev/null | grep -v ".Trash" | grep -v "node_modules" | head -60 || echo "(none found)"
echo

# ── PROJECTS FOLDER ───────────────────────────────────────
echo "PROJECTS / DOCUMENTS (top-level folders)"
divider
ls ~/Projects/ 2>/dev/null || echo "(no ~/Projects folder)"
echo
ls ~/Documents/ 2>/dev/null | head -20 || echo "(empty)"
echo

# ── RUNNING SERVICES ──────────────────────────────────────
echo "RUNNING LAUNCHD AGENTS (user)"
divider
launchctl list 2>/dev/null | grep -v "apple\|com.apple\|0x" | head -30 || echo "(none)"
echo

# ── ENV FILES / SECRETS (names only, no values) ───────────
echo "ENV / SECRET FILES FOUND (names only — no values exposed)"
divider
find "$HOME" -maxdepth 5 -name ".env*" -o -name "*.env" 2>/dev/null | \
  grep -v ".Trash" | grep -v "node_modules" | head -20 || echo "(none)"
echo

# ── GITHUB ────────────────────────────────────────────────
echo "GIT REPOS ON THIS MACHINE"
divider
find "$HOME" -maxdepth 4 -name ".git" -type d 2>/dev/null | \
  sed 's|/.git||' | grep -v ".Trash" | head -20 || echo "(none)"
echo

# ── DEVICE FINGERPRINT (for license binding) ──────────────
echo "DEVICE FINGERPRINT (used for license activation)"
divider
SERIAL=$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial/ {print $NF}' | head -1)
HOSTNAME=$(hostname)
FINGERPRINT=$(echo "${SERIAL}${HOSTNAME}" | shasum -a 256 | awk '{print $1}')
echo "Fingerprint: $FINGERPRINT"
echo "(This ID will be registered in the watchtower when activated)"
echo

divider
echo "END OF SCAN REPORT"
echo "Send this file to PROJECT X HAILMARY before activation."
divider

} | tee "$REPORT_FILE"

echo
echo "Report saved to: $REPORT_FILE"
echo "AirDrop or iMessage that file to PROJECT X HAILMARY now."
