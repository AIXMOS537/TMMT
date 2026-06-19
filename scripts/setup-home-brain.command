#!/usr/bin/env bash
# ============================================================================
# setup-home-brain.command — ONE SHOT, run ONCE on the home M1 Mac.
#
# Goal: a family member double-clicks this a single time, and from then on the
# OWNER can reach this Mac from anywhere (mostly the carry M5) over Tailscale +
# SSH. It makes the Mac: (1) joined to the owner's private tailnet, (2) SSH-able,
# (3) always-on (never sleeps, wakes on network, restarts after power loss),
# (4) auto-rejoining on every boot. Nothing else. The owner does the rest
# remotely afterward.
#
# HOW THE FAMILY MEMBER RUNS IT:
#   • Double-click this file (it opens Terminal and runs), OR in Terminal:
#       bash ~/Downloads/setup-home-brain.command
#   • Enter the Mac password when asked (needed to enable SSH + always-on).
#   • Paste the Tailscale setup key the owner sent, when prompted.
#   • Wait for the green "ALL DONE" banner. That's it — close the window.
#
# OWNER PREP (do this once, from anywhere, BEFORE sending the file):
#   1. Tailscale admin console → Settings → Keys → "Generate auth key".
#      Make it Reusable + (optional) Ephemeral OFF + give it a tag if you use
#      ACL tags. Copy the key (starts with "tskey-...").
#   2. Send the family member: THIS file + that key (text/iMessage is fine —
#      the key only joins a device to your tailnet; rotate/revoke anytime).
#
# Safe to re-run. Standalone — needs NO git/GitHub login and NO repo.
# ============================================================================
set -uo pipefail

NODE_NAME="brainiac-mac"          # how this Mac shows up on your tailnet
say(){ printf '%s\n' "$*"; }
ok(){ printf '\033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m!\033[0m %s\n' "$*" >&2; }
err(){ printf '\033[31m✗\033[0m %s\n' "$*" >&2; }
step(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
banner(){ printf '\n\033[1;32m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
step "Home Brain one-shot setup ($NODE_NAME)"
[[ "$(uname -s)" == "Darwin" ]] || { err "This is for macOS only."; exit 1; }
say "This makes THIS Mac reachable by the owner from anywhere. ~5–10 min."

# Keep sudo warm so we don't re-prompt mid-run.
say "→ You'll be asked for this Mac's password once (to enable remote access)."
sudo -v || { err "Need the Mac password to continue."; exit 1; }
# refresh sudo in the background while we work
( while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done ) 2>/dev/null &

# ---------------------------------------------------------------------------
step "1) Homebrew + Tailscale"
if ! command -v brew >/dev/null 2>&1; then
  say "Installing Homebrew (this can take a few minutes)..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || warn "Homebrew installer hit an error"
fi
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
[[ -x /usr/local/bin/brew ]] && eval "$(/usr/local/bin/brew shellenv)"
command -v brew >/dev/null 2>&1 && ok "Homebrew" || { err "Homebrew not available — install from https://brew.sh then re-run."; exit 1; }

if ! command -v tailscale >/dev/null 2>&1; then
  say "Installing Tailscale..."
  brew install tailscale 2>/dev/null || warn "brew tailscale install hit an error"
fi
command -v tailscale >/dev/null 2>&1 && ok "Tailscale CLI" || { err "Tailscale didn't install — see https://tailscale.com/download/mac"; exit 1; }

# Install the system daemon so Tailscale runs at boot, headless, forever.
step "2) Tailscale background service (survives reboots)"
if ! sudo launchctl print system/com.tailscale.tailscaled >/dev/null 2>&1; then
  sudo tailscaled install-system-daemon 2>/dev/null && ok "tailscaled installed as a system service" \
    || warn "couldn't install tailscaled daemon (may already be managed by the Tailscale app)"
else
  ok "tailscaled system service already present"
fi
sleep 2

# ---------------------------------------------------------------------------
step "3) Join the owner's tailnet (with SSH)"
TS_AUTHKEY="${TS_AUTHKEY:-}"
if [[ -z "$TS_AUTHKEY" ]]; then
  say "Paste the Tailscale setup key the owner sent (starts with 'tskey-')."
  say "Then press Enter. (Leave blank to use a login link instead.)"
  printf 'Auth key: '
  read -r TS_AUTHKEY
fi

if [[ -n "$TS_AUTHKEY" ]]; then
  sudo tailscale up --ssh --hostname="$NODE_NAME" --accept-routes --authkey="$TS_AUTHKEY" \
    && ok "Joined the tailnet as '$NODE_NAME' with SSH enabled" \
    || { err "tailscale up failed — check the key (it may be expired/used). Re-run with a fresh key."; }
else
  warn "No key given — opening a login link. The OWNER must approve it from their phone:"
  sudo tailscale up --ssh --hostname="$NODE_NAME" --accept-routes
fi

# ---------------------------------------------------------------------------
step "4) Turn on Remote Login (SSH)"
sudo systemsetup -setremotelogin on >/dev/null 2>&1 \
  && ok "Remote Login (SSH) is ON" \
  || warn "Could not toggle Remote Login via CLI. Turn it on manually: System Settings → General → Sharing → Remote Login = ON."

# ---------------------------------------------------------------------------
step "5) Always-on (never sleep, wake on network, auto-restart)"
sudo systemsetup -setcomputersleep Never >/dev/null 2>&1 && ok "Computer sleep: Never" || warn "couldn't set computer sleep"
sudo pmset -c sleep 0 >/dev/null 2>&1            && ok "No system sleep on power" || warn "pmset sleep"
sudo pmset -c disablesleep 1 >/dev/null 2>&1     && ok "Sleep disabled while on power" || true
sudo pmset -c womp 1 >/dev/null 2>&1             && ok "Wake-on-network ON" || warn "pmset womp"
sudo pmset -c autorestart 1 >/dev/null 2>&1      && ok "Auto-restart after power failure ON" || warn "pmset autorestart"
say "  (Tip: leave the Mac plugged in. Lid can be closed if an external display/power is attached, or set 'Prevent automatic sleeping' in Battery settings.)"

# ---------------------------------------------------------------------------
step "6) Confirm it's reachable"
sleep 2
TSIP="$(tailscale ip -4 2>/dev/null | head -n1)"
WHO="$(id -un)"
banner "✅ ALL DONE — this Mac is now the always-on home brain."
say "It will rejoin the tailnet automatically on every boot. You can close this window."
say ""
say "──────────────────────────────────────────────────────────────"
say " OWNER — from your carry M5 (or any device on your tailnet):"
say ""
say "   tailscale ssh ${WHO}@${NODE_NAME}"
[[ -n "$TSIP" ]] && say "   ssh ${WHO}@${TSIP}        # (this Mac's tailnet IP)"
say ""
say " From inside the TMMT repo on the carry M5:"
say "   bash scripts/mesh/link.sh assist ${NODE_NAME}"
say "──────────────────────────────────────────────────────────────"
say ""
say "Node name : ${NODE_NAME}"
say "Login user: ${WHO}"
[[ -n "$TSIP" ]] && say "Tailnet IP: ${TSIP}" || warn "No tailnet IP yet — if join needed approval, finish it in the Tailscale admin console."
