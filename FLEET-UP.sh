#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# FLEET-UP.sh — ONE paste, every device, right role. The whole fleet from one file.
#
#   bash FLEET-UP.sh            interactive — asks which machine this is
#   bash FLEET-UP.sh carry      owner command deck (carry Mac) — TOP DAWG 1
#   bash FLEET-UP.sh m1         always-on Rick operator (M1) — TOP DAWG 2
#   bash FLEET-UP.sh brainiac   heavy-compute node — driven FROM the M1
#   bash FLEET-UP.sh traptop    build the GIFT KIT for a friend's laptop (fenced!)
#   bash FLEET-UP.sh plain      just set the machine up, no role, no daemons
#
# LAW OF THE FLEET (enforced here, not just documented):
#   • carry + M1 get the full engine. They are the only ones that do.
#   • brainiac is muscle — reached over the tailnet from the M1, never primary.
#   • traptop / any friend's machine NEVER gets the engine: no repo clone, no
#     .env, no secrets, no daemons. It gets the FENCED operator kit only, and
#     she still needs your YES (grant.sh) to join. Data isolation is the rule.
#   • every role ends at GO.command — the gates decide "ready", not vibes.
# Idempotent. Online/offline safe. Never sends/pays/signs/ships on its own.
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; R=; Y=; C=; BD=; X=; fi
say(){ printf '%s\n' "$*"; }
ok(){  printf '   %s✓%s %s\n' "$G" "$X" "$*"; }
warn(){ printf '   %s!%s %s\n' "$Y" "$X" "$*"; }
step(){ printf '\n%s%s══ %s ══%s\n' "$C" "$BD" "$*" "$X"; }

# ── Find (or get) the repo ──────────────────────────────────────────────────────
ROOT=""
if git rev-parse --show-toplevel >/dev/null 2>&1 && git rev-parse --show-toplevel | grep -qi TMMT; then
  ROOT="$(git rev-parse --show-toplevel)"
else
  for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT"; do
    [[ -d "$d/.git" ]] && { ROOT="$d"; break; }
  done
fi
ROLE="${1:-${AIXMOS_ROLE:-}}"

# traptop kit-building needs the repo; everything else can clone it.
if [[ -z "$ROOT" ]]; then
  step "clone"
  ROOT="$HOME/Projects/TMMT"
  mkdir -p "$HOME/Projects"
  if command -v gh >/dev/null 2>&1; then gh repo clone AIXMOS537/TMMT "$ROOT" || true
  else git clone https://github.com/AIXMOS537/TMMT.git "$ROOT" || true; fi
  [[ -d "$ROOT/.git" ]] || { warn "couldn't clone — sign in once with 'gh auth login', then paste me again."; exit 1; }
fi
cd "$ROOT" || exit 1
git pull --ff-only origin master >/dev/null 2>&1 && ok "repo current" || warn "offline or local changes — using what's here"

# ── Pick the role ───────────────────────────────────────────────────────────────
if [[ -z "$ROLE" && -t 0 ]]; then
  step "which machine is this?"
  say "   [1] carry Mac  — owner command deck (top dawg)"
  say "   [2] M1         — always-on Rick operator (top dawg)"
  say "   [3] brainiac   — heavy compute (Windows box on the tailnet)"
  say "   [4] traptop    — build the gift kit for a friend's laptop"
  say "   [5] plain      — just set this machine up, no role"
  printf "   choose [1-5]: "; read -r c || c=5
  case "$c" in 1) ROLE=carry;; 2) ROLE=m1;; 3) ROLE=brainiac;; 4) ROLE=traptop;; *) ROLE=plain;; esac
fi
ROLE="${ROLE:-plain}"

case "$ROLE" in
# ── CARRY — owner command deck ──────────────────────────────────────────────────
carry)
  step "CARRY — owner command deck"
  [[ -f scripts/setup-mac.command ]] && bash scripts/setup-mac.command || warn "setup-mac skipped"
  [[ -x scripts/lib/install-oneshot-bin.sh ]] && bash scripts/lib/install-oneshot-bin.sh || true
  ok "one-word commands installed (garage · tmmt · booyah · hailmary)"
  step "gates verdict (the part that matters)"
  bash GO.command </dev/null || true
  say ""
  say "   ${BD}Daily driver:${X} bash GO.command   (or: bash scripts/oneshot.sh for the board)"
  ;;

# ── M1 — always-on Rick ────────────────────────────────────────────────────────
m1|rick)
  step "M1 — always-on Rick operator"
  [[ -f scripts/setup-mac.command ]] && bash scripts/setup-mac.command || warn "setup-mac skipped"
  [[ -f scripts/rick-one-shot/ACTIVATE-RICK.command ]] \
    && TMMT="$ROOT" bash scripts/rick-one-shot/ACTIVATE-RICK.command \
    || warn "ACTIVATE-RICK missing"
  step "gates verdict"
  bash GO.command </dev/null || true
  say ""
  say "   ${BD}Approve queued work:${X} bash scripts/mesh/m1-fleet-executor.sh surface"
  ;;

# ── BRAINIAC — muscle, driven from the M1 ──────────────────────────────────────
brainiac)
  step "BRAINIAC — heavy compute node"
  say "   Brainiac is Windows and is DRIVEN FROM THE M1 — you never babysit it."
  say "   On the M1, control it with:"
  say "     ${BD}bash scripts/mesh/brainiac-ctl.sh status${X}     is it reachable?"
  say "     ${BD}bash scripts/mesh/brainiac-ctl.sh wake${X}       power it up (WOL)"
  say "   One-time on the brainiac box itself:"
  say "     1) install Tailscale + sign into your tailnet (hostname: brainiac-win)"
  say "     2) enable Wake-on-LAN in BIOS; note the MAC → set BRAINIAC_MAC on the M1"
  say "     3) that's it — it auto-rejoins the mesh on every boot"
  ;;

# ── TRAPTOP — the gift. FENCED. Never the engine. ──────────────────────────────
traptop)
  step "TRAPTOP — building the gift kit (fenced operator station)"
  KIT="$HOME/Desktop/TMMT-TRAPTOP-KIT"
  mkdir -p "$KIT"
  if [[ -d dist/operator-kit ]]; then
    cp -R dist/operator-kit/. "$KIT/" && ok "operator kit staged → $KIT"
  else
    warn "dist/operator-kit missing — pull latest and re-run"; exit 1
  fi
  # What's IN the kit: ONBOARD.command (Mac/Linux) · windows-onboard.ps1 +
  # ONBOARD-ANYWHERE.cmd (the Dell) · fenced operator runtime. What's NOT in it,
  # ever: your repo, your .env, your secrets, your daemons. That's the law.
  cat > "$KIT/START-HERE-FOR-HER.md" <<'GIFT'
# Your TMMT TRAPTOP — start here 💜

This laptop is set up to help you run your day: one-word commands, your own
workspace, and a direct line into the TMMT network — safely.

## Set it up (one time, ~2 minutes)
- **Windows (this Dell):** double-click `ONBOARD-ANYWHERE.cmd`
  (or right-click `windows-onboard.ps1` → Run with PowerShell)
- **Mac/Linux:** open Terminal, run: `bash ONBOARD.command`

It installs ONLY your fenced operator toolkit. It does not read your files,
take passwords, or touch anything else on the machine.

## Then
It prints your onboarding card. Send that card back to the owner — access is
granted with an explicit YES on his side (nothing works without it). After
that you're live: your tools, your queue, your daily ops — on top of your
shit, now and forever.
GIFT
  ok "gift README written"
  say ""
  say "   ${BD}Handoff:${X} copy ${KIT##*/} to a USB (or AirDrop/OneDrive) → she runs the"
  say "   onboarder for her OS → she sends you her card → YOU approve it:"
  say "     ${BD}bash scripts/grant.sh${X}    (auto-finds her card; nobody enters without your YES)"
  say ""
  ok "her machine gets: tools, workspace, network access — FENCED"
  ok "her machine never gets: your repo, secrets, .env, daemons, or money paths"
  ;;

# ── PLAIN ──────────────────────────────────────────────────────────────────────
plain|*)
  step "PLAIN — setup only, no role, no daemons"
  [[ -f scripts/setup-mac.command ]] && bash scripts/setup-mac.command || warn "setup-mac skipped"
  bash GO.command </dev/null || true
  say "   Give it a role later:  bash FLEET-UP.sh carry|m1|brainiac|traptop"
  ;;
esac

step "done"
ok "role: $ROLE · repo: $ROOT"
