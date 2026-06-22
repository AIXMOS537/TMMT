#!/usr/bin/env bash
# operator-start — ONE shot for a new operator's Mac (run it in the morning).
# Self-bootstrapping: safe to run via `curl ... | bash` on a near-fresh Mac.
# Stands up YOUR sovereign node — your own private network, your own seal, the
# one-word commands — then shows the ONE tap to let your engineer help you.
# You own your world; this touches nobody else's.
set -uo pipefail
REPO="https://github.com/AIXMOS537/TMMT.git"
DEST="$HOME/projects/TMMT"
G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; W=$'\e[97m'; BD=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$X" >&2; }
say(){ printf '%s\n' "$*"; }
step(){ printf '\n%s== %s ==%s\n' "$C$BD" "$*" "$X"; }

cat <<'B'

   ╔════════════════════════════════════════════════╗
   ║  WELCOME — standing up YOUR own system  🐦‍⬛⚡   ║
   ╚════════════════════════════════════════════════╝
B

# 1) Tools — git comes from Xcode CLT; trigger it if missing and bail to re-run.
step "1/4 · Tools"
if ! command -v git >/dev/null 2>&1; then
  warn "Installing Apple developer tools — click INSTALL in the popup, let it finish,"
  warn "then run this same command again."
  xcode-select --install >/dev/null 2>&1 || true
  exit 0
fi
ok "git ready"
if ! command -v brew >/dev/null 2>&1; then
  say "  (optional) installing Homebrew for Tailscale + extras…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null >/dev/null 2>&1 || warn "Homebrew skipped"
fi
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
command -v tailscale >/dev/null 2>&1 || brew install tailscale >/dev/null 2>&1 || true

# 2) Get the code.
step "2/4 · Code"
if [ -d "$DEST/.git" ]; then ( cd "$DEST" && git fetch origin -q && git reset --hard origin/master -q ) && ok "updated $DEST"
else git clone -q "$REPO" "$DEST" && ok "cloned to $DEST"; fi
cd "$DEST" || { warn "could not enter $DEST"; exit 1; }

# 3) Sovereign setup — your own node, your own everything.
step "3/4 · Your sovereign setup"
bash scripts/one-shot.sh own || warn "setup returned warnings (continuing)"

# 4) Your private network + the one tap for your engineer.
step "4/4 · Your private network"
if command -v tailscale >/dev/null 2>&1; then
  say "  Bringing up Tailscale — log in with ${BD}YOUR OWN${X} account (a browser opens):"
  sudo tailscale up 2>/dev/null || tailscale up 2>/dev/null || warn "run 'sudo tailscale up' yourself if it didn't open"
  MYNAME="$(tailscale status --self --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin).get("Self",{}).get("HostName",""))' 2>/dev/null || true)"
else
  warn "Tailscale not installed — get it at https://tailscale.com/download, then: sudo tailscale up"
  MYNAME=""
fi

cat <<EOF

${G}${BD}✓ YOUR SYSTEM IS UP.${X}  Open a new Terminal and type:  ${BD}menu${X}

${Y}${BD}ONE LAST TAP — so your engineer (Taha) can help when you want:${X}
   1) Open the ${BD}Tailscale${X} app (menu bar) → ${BD}Share${X} this machine to Taha's account
   2) Turn on ${BD}Tailscale SSH${X} for this machine
   3) Text Taha:  "done${MYNAME:+ — my machine is ${MYNAME}}"

${D}You stay in full control — you can un-share anytime. This is YOUR world.${X}

EOF
