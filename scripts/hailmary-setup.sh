#!/usr/bin/env bash
#
# HAILMARY local-agent setup — run on the work Mac AND the carry Mac.
#
# Makes each Mac a HAILMARY node that:
#   - shares ONE brain (Memory Fabric) over Tailscale, so the Macs (and iPhone)
#     stay in sync and can leave each other notes
#   - has the `hailmary` CLI installed
#   - registers MCP servers for local Claude Code (memory bridge; + iMessage on
#     the work Mac so HAILMARY can text from your work cell)
#
# Usage:
#   bash scripts/hailmary-setup.sh --role work  --brain-url https://brainiac.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
#   bash scripts/hailmary-setup.sh --role carry --brain-url https://brainiac.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
#
# Re-runnable (idempotent). Best-effort installs; prints what to finish by hand.
set -euo pipefail

ROLE=""; BRAIN_URL=""; TOKEN=""; NODE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --role) ROLE="${2:-}"; shift 2;;
    --brain-url) BRAIN_URL="${2:-}"; shift 2;;
    --token) TOKEN="${2:-}"; shift 2;;
    --node) NODE="${2:-}"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done

[ "$(uname)" = "Darwin" ] || { echo "This script is for macOS (work/carry Mac)." >&2; exit 1; }
case "$ROLE" in work|carry) ;; *) echo "--role must be 'work' or 'carry'" >&2; exit 1;; esac
[ -n "$NODE" ] || NODE="${ROLE}-mac"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
say() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

# ---- 1. Homebrew + base tools -------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  say "Installing Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
for pkg in jq node uv; do
  command -v "$pkg" >/dev/null 2>&1 || { say "brew install $pkg"; brew install "$pkg" || warn "could not install $pkg"; }
done

# ---- 2. Claude Code CLI -------------------------------------------------------
if ! command -v claude >/dev/null 2>&1; then
  say "Installing Claude Code CLI…"
  npm install -g @anthropic-ai/claude-code || warn "install Claude Code manually: npm i -g @anthropic-ai/claude-code"
fi

# ---- 3. Tailscale (the mesh that links every node) ----------------------------
if ! command -v tailscale >/dev/null 2>&1 && [ ! -d "/Applications/Tailscale.app" ]; then
  warn "Tailscale not found. Install it: brew install --cask tailscale  (then open it and 'tailscale up')."
else
  say "Tailscale present — ensure this Mac has joined the tailnet (tailscale status)."
fi

# ---- 4. Config + persona ------------------------------------------------------
mkdir -p "$HOME/.hailmary"
CONFIG="$HOME/.hailmary/config.env"
cat > "$CONFIG" <<EOF
# HAILMARY node config — edit the URL/token if they change.
MEMORY_API_URL="${BRAIN_URL:-${MEMORY_API_URL:-}}"
MEMORY_API_TOKEN="${TOKEN:-${MEMORY_API_TOKEN:-}}"
HAILMARY_NODE="${NODE}"
HAILMARY_ROLE="${ROLE}"
# Local-first AI (free, unlimited). Point at the Brainiac Ollama over Tailscale.
# 'hailmary do' uses this first and only falls back to Claude if it's unreachable.
OLLAMA_URL="${OLLAMA_URL:-http://brainiac:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
# ANTHROPIC_API_KEY="<optional fallback>"
EOF
chmod 600 "$CONFIG"
say "Wrote $CONFIG (node=$NODE role=$ROLE)"

cat > "$HOME/.hailmary/HAILMARY.md" <<'EOF'
# HAILMARY — local agent operating rules

You are HAILMARY, the owner's personal local agent. "Hailmary" denotes the OWNER
exclusively; you act on his behalf — never adopt the name as your own identity.

Operative mode (PROJECTX-HAILMARY): think and move like a lawful operative —
investigative, resourceful, relentless, calm. Define the true objective, inventory
and repurpose what's on hand (rubber-band-in-a-stripped-screw ingenuity), calibrate
force, hold two truths (it CAN fail AND it MUST get done), keep a fallback tree.
Legal & safe only. Full doctrine: docs/PROJECTX-HAILMARY.md.

Discipline (every task):
1. RECALL relevant context from the shared brain BEFORE acting (`hailmary recall`
   or the memory MCP `recall` tool).
2. Do the task.
3. REMEMBER what you did AFTER (`hailmary remember` / memory `remember`).

Hard rules:
- NEVER contact the owner's personal line (+1 571-351-9690). It is do_not_contact.
- Reach the owner only on the work cell (+1 571-326-5611) during working hours.
- Quo is the customer-support + vendor line; GHL is campaigns/ads/leads.
- All nodes (work Mac, carry Mac, iPhone) share one brain — leave notes for the
  others with `hailmary note <node> "…"`; read yours with `hailmary inbox`.
EOF
say "Wrote ~/.hailmary/HAILMARY.md"

# ---- 5. Install the hailmary CLI ---------------------------------------------
DEST="/usr/local/bin/hailmary"
if [ -w "$(dirname "$DEST")" ]; then
  cp "$REPO_ROOT/bin/hailmary" "$DEST" && chmod +x "$DEST"
else
  sudo cp "$REPO_ROOT/bin/hailmary" "$DEST" && sudo chmod +x "$DEST"
fi
say "Installed: $DEST"

# ---- 6. Register MCP servers for local Claude Code ---------------------------
if command -v claude >/dev/null 2>&1; then
  say "Registering memory MCP bridge…"
  claude mcp add hailmary-memory \
    --env MEMORY_API_URL="${BRAIN_URL}" --env MEMORY_API_TOKEN="${TOKEN}" \
    -- node "$REPO_ROOT/scripts/memory-mcp-server.mjs" 2>/dev/null \
    || warn "memory MCP may already be registered (claude mcp list)"

  if [ "$ROLE" = "work" ]; then
    say "Registering Mac iMessage bridge (work Mac = the texting assistant)…"
    claude mcp add messages -- uvx mac-messages-mcp 2>/dev/null \
      || warn "messages MCP may already be registered"
    warn "Grant Full Disk Access to your terminal (System Settings → Privacy & Security → Full Disk Access), then fully quit & reopen it."
  fi
else
  warn "Claude Code CLI missing — skipped MCP registration."
fi

# ---- 7. Done ------------------------------------------------------------------
echo
say "HAILMARY node '$NODE' ready."
echo "  Try:  hailmary status   &&   hailmary recall \"John Lopez\""
echo "  Sync: hailmary note carry-mac \"check the 8am pickup\"   (read on the other Mac: hailmary inbox)"
[ -n "${BRAIN_URL}" ] || warn "Set MEMORY_API_URL in $CONFIG (your brain over Tailscale)."
[ -n "${TOKEN}" ] || warn "Set MEMORY_API_TOKEN in $CONFIG (same as the app)."
echo "  iPhone setup: see docs/HAILMARY.md (Tailscale app + a Shortcut that POSTs to the brain)."
