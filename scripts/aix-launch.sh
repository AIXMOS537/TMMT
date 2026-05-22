#!/usr/bin/env bash
# AIX Command Center launcher for the M5 Pro (AIX-CARRY)
#
# Opens everything needed to work remotely:
#   - Canonical TMMT in Cursor
#   - Tailscale-routed office Mac dev server in the browser
#   - AnyDesk for the home Windows PC
#   - AIXMOS marketing + portal pages in the browser
#
# Edit the TODO hostnames below the first time you run this on the M5 Pro.
# Re-run anytime; it's idempotent.

set -u

# ─── EDIT THESE (one-time) ─────────────────────────────────────────────────────
OFFICE_MAC_TS_HOST="TODO-office-mac-tailscale-name"   # e.g. "tmmts-macbook-pro" — from Tailscale admin
HOME_PC_TS_HOST="TODO-home-pc-tailscale-name"         # e.g. "home-windows"
# ───────────────────────────────────────────────────────────────────────────────

TMMT_DIR="$HOME/Documents/TMMT"
AIXMOS_DIR="$HOME/Documents/AIXMOS"

say() { printf "\033[1;34m[aix]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[aix] %s\033[0m\n" "$*"; }

# 1. Open canonical TMMT in Cursor (the rentals app + command center)
if command -v cursor >/dev/null 2>&1 ; then
  say "opening TMMT in Cursor"
  cursor "$TMMT_DIR" >/dev/null 2>&1 &
else
  warn "cursor CLI not found — open $TMMT_DIR manually"
fi

# 2. Office Mac dev server via Tailscale (browser tab)
if [[ "$OFFICE_MAC_TS_HOST" == TODO* ]] ; then
  warn "OFFICE_MAC_TS_HOST is unset — edit $0 to add the Tailscale hostname"
else
  say "opening office dev server http://$OFFICE_MAC_TS_HOST:3000"
  open "http://$OFFICE_MAC_TS_HOST:3000" >/dev/null 2>&1 || true
fi

# 3. Home Windows PC via AnyDesk
if [[ -d /Applications/AnyDesk.app ]] ; then
  say "launching AnyDesk (home PC)"
  open -a AnyDesk >/dev/null 2>&1 &
else
  warn "AnyDesk.app not found in /Applications"
fi

if [[ "$HOME_PC_TS_HOST" != TODO* ]] ; then
  say "home PC Tailscale host: $HOME_PC_TS_HOST  (paste into AnyDesk if needed)"
fi

# 4. AIXMOS pages
if [[ -f "$AIXMOS_DIR/index.html" ]] ; then
  say "opening AIXMOS marketing index"
  open "$AIXMOS_DIR/index.html" >/dev/null 2>&1 || true
fi
if [[ -f "$TMMT_DIR/AIXMOS/operator.html" ]] ; then
  say "opening AIXMOS operator portal (nested)"
  open "$TMMT_DIR/AIXMOS/operator.html" >/dev/null 2>&1 || true
fi

# 5. Local TMMT production URL (Vercel) so the team sees it live
say "opening live TMMT (tmmt-command-center.vercel.app)"
open "https://tmmt-command-center.vercel.app" >/dev/null 2>&1 || true

say "done"
