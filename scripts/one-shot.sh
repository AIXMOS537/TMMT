#!/usr/bin/env bash
# one-shot — the universal installer for ANY device, for ANYONE.
#
# One question decides everything:
#   • MINE    — PROJECT X HAILMARY's own device → joins HIS mesh (owner, sealed).
#   • MY OWN  — family / friend / anyone → stands up THEIR OWN private mesh on
#               THEIR OWN Tailscale login, fully isolated. It CANNOT touch or
#               hurt the Owner's network, secrets, or seal.
#
# Why it's safe: isolation is at the Tailscale-ACCOUNT level. Each person logs
# into THEIR OWN Tailscale account → their own tailnet → zero overlap with yours.
# Bridging two meshes only ever happens later by explicit node-share (your OK).
#
#   bash scripts/one-shot.sh            # asks who it's for
#   bash scripts/one-shot.sh mine       # the Owner's device
#   bash scripts/one-shot.sh own        # a family/friend's own sovereign mesh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd 2>/dev/null || echo "$PWD")"
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; W=$'\e[97m'; D=$'\e[2m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; W=; D=; BD=; X=; fi
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
info(){ printf '  › %s\n' "$*"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$X" >&2; }
say(){ printf '%s\n' "$*"; }
osname(){ case "$(uname -s 2>/dev/null)" in Darwin) echo macos;; Linux) echo linux;; *) echo other;; esac; }

TENANT="${1:-}"
if [ -z "$TENANT" ]; then
  say
  say "  ${BD}Who is this device for?${X}"
  say "   [1] ${BD}MINE${X}    — PROJECT X HAILMARY's own device (joins your mesh)"
  say "   [2] ${BD}MY OWN${X}  — family / friend: your own private network"
  printf '  > '; IFS= read -r p || true
  [ "$p" = "1" ] && TENANT=mine || TENANT=own
fi

say
say "  ┌────────────────────────────────────────────────┐"
say "  │  ONE-SHOT · $( [ "$TENANT" = mine ] && echo "OWNER (your mesh)" || echo "SOVEREIGN (their own mesh)" )"
say "  └────────────────────────────────────────────────┘"

# ============================================================ MINE (the Owner)
if [ "$TENANT" = "mine" ]; then
  info "this is the Owner's device → joining your mesh as owner (sealed)."
  exec bash "$ROOT/scripts/deploy" owner
fi

# ====================================================== MY OWN (sovereign node)
# A family member / friend becomes the OWNER OF THEIR OWN private mesh. Nothing
# here reads, copies, or joins the real Owner's tailnet/secrets/seal.
say
ok "Setting up YOUR OWN private network — separate from anyone else's."
say "$D   You'll be the owner of your own node. Your data, your keys, your mesh.$X"

# 1) Identity (theirs) — never the Owner's.
mkdir -p "$ROOT/.swarm"
printf '%s' "own" > "$ROOT/.swarm/tenant"
if [ ! -s "$ROOT/.swarm/machine" ]; then
  printf '  Name this device (e.g. moms-mac, ali-laptop): '; IFS= read -r mn || true
  [ -n "${mn:-}" ] && printf '%s' "$mn" > "$ROOT/.swarm/machine"
fi
# Their node is sovereign: they are owner of THEIR mesh.
printf '%s' "owner" > "$ROOT/.swarm/role"

# 2) Safety: make sure no Owner secrets are present on this sovereign clone.
for s in ".env" "tools/project-x-hailmary/master/vault.enc" "auth/OWNER.seal"; do
  if [ -e "$ROOT/$s" ]; then
    warn "found '$s' on this machine — that belongs to the Owner, not you."
    warn "this sovereign setup will NOT use it. Remove it if this isn't the Owner's device."
  fi
done

# 3) Secret-guard hooks (so they never leak keys either).
git -C "$ROOT" config core.hooksPath scripts/hooks 2>/dev/null || true
ok "secret-guard installed"

# 4) Their OWN Tailscale — their login, their tailnet (the isolation guarantee).
say
say "  ${BD}YOUR private network (Tailscale):${X}"
if command -v tailscale >/dev/null 2>&1; then
  say "   Run this and log in with ${BD}YOUR OWN${X} account (Google/email/etc.):"
  say "     ${W}sudo tailscale up${X}"
  say "   That login creates ${BD}your own private tailnet${X}. It does not join anyone else's."
else
  case "$(osname)" in
    macos) say "   Install Tailscale: ${W}brew install tailscale${X}  (or the Mac App Store app)";;
    linux) say "   Install Tailscale: ${W}curl -fsSL https://tailscale.com/install.sh | sh${X}";;
    *)     say "   Install Tailscale from: ${W}https://tailscale.com/download${X}";;
  esac
  say "   Then: ${W}sudo tailscale up${X}  — log in with ${BD}YOUR OWN${X} account."
fi

# 5) Their OWN owner seal (their authority over their own node).
say
if [ -x "$ROOT/scripts/owner-seal.sh" ]; then
  printf '  Set YOUR OWN owner seal now (locks your node to you)? [y/N] '; IFS= read -r yn || true
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    rm -f "$ROOT/auth/OWNER.seal" 2>/dev/null || true
    bash "$ROOT/scripts/owner-seal.sh" seal || warn "seal not set (you can run 'seal' later)"
  else
    say "$D   skipped — you can claim it later: bash scripts/owner-seal.sh seal$X"
  fi
fi

# 6) Install the one-word commands on their node.
info "installing your one-word commands…"
SWARM_ROLE="owner" bash "$ROOT/scripts/go" >/dev/null 2>&1 || warn "command install had warnings"

say
ok "YOUR sovereign node is ready — isolated from every other mesh."
say "   open a new terminal and type:  ${BD}menu${X}    (or ${BD}booyah${X} to boot your base)"
say "$D   your network ≠ the Owner's. To ever link them, the Owner shares a node to you on purpose.$X"
