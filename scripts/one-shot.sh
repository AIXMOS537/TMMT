#!/usr/bin/env bash
# one-shot — THE single across-the-board installer. Run the SAME command on every
# machine; it figures out (or you tell it) which device this is and provisions it.
#
# The fleet (docs/FLEET-ROSTER.md):
#   • carry     — the Owner's carry Mac (M5) → owner kit, mobile command   [carry-mac]
#   • brain     — the Owner's M1 Mac → owner kit + always-on home brain     [brainiac-mac]
#   • moe       — Moe Legacy / Umar's Mac → fenced operator (Red Hood)      [moe-legacy]
#   • own       — family / friend → THEIR OWN private mesh, fully isolated
#
#   bash scripts/one-shot.sh            # asks which machine this is
#   bash scripts/one-shot.sh carry      # the Owner's carry M5
#   bash scripts/one-shot.sh brain      # the Owner's M1 (also sets up always-on)
#   bash scripts/one-shot.sh moe        # Moe Legacy operator (fenced)
#   bash scripts/one-shot.sh own        # someone's own sovereign mesh
#   bash scripts/one-shot.sh --help
#
# Idempotent and safe to re-run. Owner roles delegate to scripts/deploy (mesh
# onboard + secret-guard + one-word commands); the brain adds the always-on
# home-brain setup; the operator path is fenced (never owner). Isolation for
# 'own' is at the Tailscale-account level — it cannot touch the Owner's mesh.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd 2>/dev/null || echo "$PWD")"
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; W=$'\e[97m'; D=$'\e[2m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; W=; D=; BD=; X=; fi
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
info(){ printf '  › %s\n' "$*"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$X" >&2; }
say(){ printf '%s\n' "$*"; }
osname(){ case "$(uname -s 2>/dev/null)" in Darwin) echo macos;; Linux) echo linux;; *) echo other;; esac; }

usage(){ sed -n '2,28p' "$0"; exit 0; }

# Canonical mesh name for a known role (docs/FLEET-ROSTER.md). Set into
# .swarm/machine only if this device has no name yet — never clobber a chosen one.
set_machine_name(){
  local want="$1"; local f="$ROOT/.swarm/machine"
  mkdir -p "$ROOT/.swarm"
  if [ ! -s "$f" ]; then printf '%s' "$want" > "$f"; ok "mesh name set: $want"; fi
}

ROLE="${1:-}"
case "$ROLE" in
  -h|--help|help) usage;;
esac

# Back-compat + synonyms.
case "$ROLE" in
  mine) ROLE=carry;;                         # old "MINE" = the Owner's device
  carry-mac|carry) ROLE=carry;;
  brainiac-mac|brain|m1) ROLE=brain;;
  moe-legacy|moe|umar|operator|red-hood) ROLE=moe;;
  own|sovereign|family|friend) ROLE=own;;
esac

if [ -z "$ROLE" ]; then
  say
  say "  ${BD}Which machine is this?${X}"
  say "   [1] ${BD}carry${X}  — the Owner's carry Mac (M5)"
  say "   [2] ${BD}brain${X}  — the Owner's M1 Mac (always-on home brain)"
  say "   [3] ${BD}moe${X}    — Moe Legacy / Umar's Mac (fenced operator)"
  say "   [4] ${BD}own${X}    — someone else's own private mesh"
  printf '  > '; IFS= read -r p || true
  case "${p:-}" in 1) ROLE=carry;; 2) ROLE=brain;; 3) ROLE=moe;; 4) ROLE=own;; *) ROLE=carry;; esac
fi

banner(){ say; say "  ┌────────────────────────────────────────────────┐"; say "  │  ONE-SHOT · $1"; say "  └────────────────────────────────────────────────┘"; }

# ===================================================== carry — Owner's carry M5
if [ "$ROLE" = "carry" ]; then
  banner "CARRY (Owner · mobile command)"
  set_machine_name "carry-mac"
  exec bash "$ROOT/scripts/deploy" owner
fi

# ============================================== brain — Owner's M1 (always-on)
if [ "$ROLE" = "brain" ]; then
  banner "BRAIN (Owner · M1 · always-on)"
  set_machine_name "brainiac-mac"
  info "provisioning owner kit…"
  bash "$ROOT/scripts/deploy" owner || warn "deploy had warnings (continuing)"
  if [ "$(osname)" = "macos" ] && [ -f "$ROOT/scripts/setup-home-brain.command" ]; then
    say
    printf '  Make this Mac the always-on home brain now (SSH + Tailscale + never-sleep)? [y/N] '
    IFS= read -r yn || true
    case "${yn:-}" in y|Y) bash "$ROOT/scripts/setup-home-brain.command" || warn "home-brain setup had warnings";;
      *) say "$D   skipped — run later: bash scripts/setup-home-brain.command$X";; esac
  else
    say "$D   (always-on home-brain step is macOS-only: scripts/setup-home-brain.command)$X"
  fi
  [ -x "$ROOT/scripts/swarm-doctor.sh" ] && bash "$ROOT/scripts/swarm-doctor.sh" --quick 2>/dev/null || true
  ok "BRAIN ready."
  exit 0
fi

# ================================================ moe — Moe Legacy (fenced op)
if [ "$ROLE" = "moe" ]; then
  banner "MOE LEGACY (Operator · fenced · Red Hood)"
  set_machine_name "moe-legacy"
  # Fenced provision. The full Red Hood kit (credit-guidance tools, banners) is
  # scripts/umar-setup.command for a from-scratch machine; deploy operator is the
  # idempotent re-runnable core (onboard + secret-guard + operator commands).
  exec bash "$ROOT/scripts/deploy" operator
fi

# ====================================================== own — sovereign node
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
