#!/usr/bin/env bash
#
# setup-mac-imessage-bridge.sh
# ---------------------------------------------------------------------------
# Sets up an iMessage bridge so Claude Code (running locally on this Mac) can
# send/read iMessages through the macOS Messages app.
#
# Bridge used: carterlasalle/mac_messages_mcp  (https://github.com/carterlasalle/mac_messages_mcp)
#   - stdio MCP server, runs locally, supports SENDING and reading iMessages.
#
# IMPORTANT: This must run ON THE MAC, in the same place Claude Code runs.
# A cloud / web Claude session cannot reach a stdio server on your Mac.
# ---------------------------------------------------------------------------
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }
die()  { printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

bold "== TMMT • Mac iMessage bridge setup =="

# 1. Must be macOS
[ "$(uname -s)" = "Darwin" ] || die "This script only runs on macOS (got $(uname -s)). Run it on your work Mac."
ok "Running on macOS $(sw_vers -productVersion 2>/dev/null || echo '?')"

# 2. uv package manager (provides uvx)
if ! command -v uv >/dev/null 2>&1; then
  warn "uv not found."
  if command -v brew >/dev/null 2>&1; then
    bold "Installing uv via Homebrew..."
    brew install uv
  else
    bold "Installing uv via official installer..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # shellcheck disable=SC1090
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi
command -v uvx >/dev/null 2>&1 || die "uvx still not on PATH. Open a new terminal and re-run."
ok "uv / uvx available ($(uv --version 2>/dev/null || echo '?'))"

# 3. Pre-fetch the server so first run is fast & to surface install errors now
bold "Fetching mac-messages-mcp..."
uvx --help >/dev/null 2>&1 || true
uv pip install --system mac-messages-mcp >/dev/null 2>&1 || uvx mac-messages-mcp --help >/dev/null 2>&1 || true
ok "mac-messages-mcp ready (will run via: uvx mac-messages-mcp)"

# 4. Register with Claude Code CLI if present
if command -v claude >/dev/null 2>&1; then
  bold "Registering MCP server 'messages' with Claude Code..."
  if claude mcp list 2>/dev/null | grep -q "^messages\b"; then
    ok "MCP server 'messages' already registered."
  else
    claude mcp add messages -- uvx mac-messages-mcp
    ok "Registered. Verify with: claude mcp list"
  fi
else
  warn "Claude Code CLI ('claude') not found on PATH."
  warn "Install it, then run:  claude mcp add messages -- uvx mac-messages-mcp"
  warn "OR add the snippet from docs/MAC-IMESSAGE-BRIDGE.md to your client config."
fi

cat <<'PERMS'

------------------------------------------------------------------
ONE MANUAL STEP LEFT — grant Full Disk Access (required):

  System Settings → Privacy & Security → Full Disk Access
    → enable it for your Terminal app (and/or Claude Desktop/Cursor)
    → fully quit & reopen that app.

Without this, the bridge cannot read the Messages database and
sending/reading will fail silently.
------------------------------------------------------------------

Test after granting access (in a LOCAL Claude Code session on this Mac):
  "Send an iMessage to <your number> saying 'bridge test'."

PERMS
bold "Done."
