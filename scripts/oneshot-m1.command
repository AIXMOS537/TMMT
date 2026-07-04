#!/usr/bin/env bash
# ============================================================================
# oneshot-m1.command — FRESH M1 → fully running, guarded home brain. ONE SHOT.
#
# Assumes a brand-new Mac with NOTHING installed. Double-click it, or run:
#     bash scripts/oneshot-m1.command            # do it
#     bash scripts/oneshot-m1.command --check     # dry-run: show the plan, change nothing
#
# It installs and wires, in order:
#   0) macOS + always-on power settings
#   1) Homebrew
#   2) git · node · ollama · tailscale
#   3) start Ollama (as a background service)
#   4) get the repo (use the one you're in, else clone $AIXMOS_REPO_URL)
#   5) npm ci
#   6) hand off to activate-m1-brain.sh — lays down the Home Brain Safety Layer,
#      PROVES the guard works on this machine, pulls models, installs the
#      always-on router LaunchAgent. Refuses to finish if the guard fails.
#   7) (optional) join the tailnet if TS_AUTHKEY is set
#
# Env you can set: AIXMOS_REPO_URL, AIXMOS_DIR (default ~/TMMT),
#                  AIXMOS_DAILY_CAP_USD (default 10), TS_AUTHKEY (tailnet join)
# Idempotent + safe to re-run. --check touches nothing and runs anywhere.
# ============================================================================
set -uo pipefail

MODE="${1:-run}"; DRY=0; [ "$MODE" = "--check" ] && DRY=1
if [ "$DRY" = 1 ]; then DRYLABEL=" (dry-run)"; WOULD="WOULD BE "; else DRYLABEL=""; WOULD=""; fi

if [ -t 1 ]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; R=; Y=; BD=; X=; fi
say(){ printf '%s\n' "$*"; }
ok(){   printf '%s✓%s %s\n' "$G" "$X" "$*"; }
warn(){ printf '%s!%s %s\n' "$Y" "$X" "$*" >&2; }
err(){  printf '%s✗%s %s\n' "$R" "$X" "$*" >&2; }
step(){ printf '\n%s== %s ==%s\n' "$BD" "$*" "$X"; }
banner(){ printf '\n%s%s%s\n' "$BD$G" "$*" "$X"; }
run(){ if [ "$DRY" = 1 ]; then say "   would: $*"; else eval "$*"; fi; }
have(){ command -v "$1" >/dev/null 2>&1; }

IS_MAC=0; [ "$(uname -s)" = "Darwin" ] && IS_MAC=1
AIXMOS_DIR="${AIXMOS_DIR:-$HOME/TMMT}"

step "ONE-SHOT M1 brain bring-up$DRYLABEL"
[ "$IS_MAC" = 1 ] || warn "not macOS — install/power/tailnet steps are macOS-only; running what's portable"

# ---------------------------------------------------------------------------
step "0) Always-on power (never sleep, wake on net, restart after power loss)"
if [ "$IS_MAC" = 1 ]; then
  run "sudo pmset -a sleep 0 disksleep 0 womp 1 autorestart 1 powernap 1"
else
  say "   (skipped — not macOS)"
fi

# ---------------------------------------------------------------------------
step "1) Homebrew"
if have brew; then ok "Homebrew present"
else
  warn "Homebrew missing"
  run '/bin/bash -c "NONINTERACTIVE=1 $(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
fi
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
[ -x /usr/local/bin/brew ]   && eval "$(/usr/local/bin/brew shellenv)"   2>/dev/null || true

# ---------------------------------------------------------------------------
step "2) git · node · ollama · tailscale"
for f in git node ollama; do
  if have "$f"; then ok "$f present"; else warn "$f missing"; run "brew install $f"; fi
done
if have tailscale; then ok "tailscale present"; else warn "tailscale missing"; run "brew install --cask tailscale"; fi

# ---------------------------------------------------------------------------
step "3) Start Ollama"
if have ollama; then run "brew services start ollama"; ok "ollama service requested"
else warn "ollama not installed yet — will start after install / on re-run"; fi

# ---------------------------------------------------------------------------
step "4) Get the repo"
if [ -f package.json ] && grep -q '"tmmt-app"' package.json 2>/dev/null; then
  AIXMOS_DIR="$PWD"; ok "using the repo you're in: $AIXMOS_DIR"
elif [ -d "$AIXMOS_DIR/.git" ]; then
  ok "repo already at $AIXMOS_DIR"
elif [ -n "${AIXMOS_REPO_URL:-}" ]; then
  run "git clone '$AIXMOS_REPO_URL' '$AIXMOS_DIR'"
else
  err "Not in the repo and AIXMOS_REPO_URL not set."
  say "   Fix: run this from inside the cloned repo, OR set AIXMOS_REPO_URL=git@github.com:AIXMOS537/TMMT.git"
  [ "$DRY" = 1 ] || exit 1
fi
[ -d "$AIXMOS_DIR" ] && cd "$AIXMOS_DIR" 2>/dev/null || true

# ---------------------------------------------------------------------------
step "5) Install dependencies"
if have npm; then run "npm ci"; else warn "npm not on PATH yet — open a new shell (brew node) and re-run"; fi

# ---------------------------------------------------------------------------
step "6) Activate the guarded brain"
if [ -f scripts/activate-m1-brain.sh ]; then
  if [ "$DRY" = 1 ]; then run "bash scripts/activate-m1-brain.sh --check"
  else bash scripts/activate-m1-brain.sh || { err "activation failed (guard not verified) — stopping"; exit 1; }; fi
else
  err "scripts/activate-m1-brain.sh not found — are you in the repo root?"
  [ "$DRY" = 1 ] || exit 1
fi

# ---------------------------------------------------------------------------
step "7) Tailnet (optional)"
if [ -n "${TS_AUTHKEY:-}" ] && have tailscale; then
  run "sudo tailscale up --authkey '$TS_AUTHKEY' --hostname brainiac-mac --ssh"
  ok "tailnet join requested as brainiac-mac (+ SSH)"
else
  say "   set TS_AUTHKEY to auto-join the tailnet, or run scripts/setup-home-brain.command"
fi

banner "M1 ${WOULD}FULLY UP"
say "Kill switch (phone):  touch \$HOME/.aixmos/HALT     Resume:  rm \$HOME/.aixmos/HALT"
say "Router:               http://<brain-tailnet-ip>:4000/v1"
[ "$DRY" = 1 ] && say "${Y}(dry-run — nothing changed. Re-run without --check to do it for real.)${X}"
exit 0
