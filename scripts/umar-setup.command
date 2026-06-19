#!/usr/bin/env bash
# ============================================================
# RED HOOD ONBOARDING — Umar's Carry Mac Setup
# Run this ON UMAR'S MACHINE after plugging in CYBORG.
# Sets up his mesh identity, Tailscale node, credit guidance
# tools, and heartbeat. Fenced operator — never owner.
# ============================================================
set -uo pipefail
REPO_URL="https://github.com/AIXMOS537/TMMT.git"
INSTALL_DIR="$HOME/TMMT-OPS"
RED=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; BD=$'\e[1m'; CY=$'\e[36m'; X=$'\e[0m'

ok()   { printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
warn() { printf '%s  ⚠ %s%s\n' "$Y" "$*" "$X"; }
die()  { printf '%s  ✗ %s%s\n' "$RED" "$*" "$X"; exit 1; }
say()  { printf '\n%s%s%s\n' "$BD" "$*" "$X"; }

clear
printf '%s%s\n' "$CY$BD" "
  ██████╗ ███████╗██████╗     ██╗  ██╗ ██████╗  ██████╗ ██████╗
  ██╔══██╗██╔════╝██╔══██╗    ██║  ██║██╔═══██╗██╔═══██╗██╔══██╗
  ██████╔╝█████╗  ██║  ██║    ███████║██║   ██║██║   ██║██║  ██║
  ██╔══██╗██╔══╝  ██║  ██║    ██╔══██║██║   ██║██║   ██║██║  ██║
  ██║  ██║███████╗██████╔╝    ██║  ██║╚██████╔╝╚██████╔╝██████╔╝
  ╚═╝  ╚═╝╚══════╝╚═════╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝
"
printf '%s' "$X"
printf '  Credit Guidance Operator — Powered by AIXMOS\n'
printf '  Role: 🐦‍⬛ Red Hood | Vertical: Credit Guidance\n'
printf '  Controlled by: Muhammad Taha / AIXMOS Watchtower\n\n'

# ── STEP 1: CONFIRM IDENTITY ──────────────────────────────
say "STEP 1 — Confirm your identity"
read -p "  Enter your name (e.g. Umar): " OP_NAME
read -p "  Enter your email: " OP_EMAIL
printf '\n'
ok "Welcome, $OP_NAME. Setting up your Red Hood station."

# ── STEP 2: CHECK TOOLING ─────────────────────────────────
say "STEP 2 — Checking required tools"
MISS=0
for t in git node npm curl; do
  command -v "$t" &>/dev/null && ok "$t installed" || { warn "$t missing — install it first"; MISS=1; }
done
[[ $MISS -eq 1 ]] && die "Install missing tools then re-run."

# ── STEP 3: CLONE OR UPDATE REPO ─────────────────────────
say "STEP 3 — Syncing TMMT codebase"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  cd "$INSTALL_DIR" && git pull --rebase origin master 2>&1 | tail -2
  ok "Repo updated at $INSTALL_DIR"
else
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>&1 | tail -3
  ok "Repo cloned to $INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ── STEP 4: MESH IDENTITY — FENCED OPERATOR ───────────────
say "STEP 4 — Mesh identity (operator / fenced)"
mkdir -p .swarm
echo "red-hood-$(echo "$OP_NAME" | tr '[:upper:] ' '[:lower:]-')" > .swarm/machine
echo "operator" > .swarm/role
git config user.name  "$OP_NAME"
git config user.email "$OP_EMAIL"
ok "Mesh identity: $(cat .swarm/machine) | role: operator"

# ── STEP 5: SECRET GUARD HOOKS ───────────────────────────
say "STEP 5 — Installing secret-guard hooks"
git config core.hookspath .githooks
ok "Secret-guard hooks active — nothing sensitive leaves this machine"

# ── STEP 6: OPERATOR ENV ─────────────────────────────────
say "STEP 6 — Operator environment"
mkdir -p ~/.config/tmmt
if [[ ! -f ~/.config/tmmt/red-hood.env ]]; then
  cat > ~/.config/tmmt/red-hood.env << ENV
# RED HOOD — Credit Guidance Operator Config
OPERATOR_NAME=$OP_NAME
OPERATOR_EMAIL=$OP_EMAIL
OPERATOR_ROLE=red-hood
OPERATOR_VERTICAL=credit-guidance
SUPABASE_URL=https://uapxakmlwnpfsftfeezx.supabase.co
# SUPABASE_ANON_KEY= (pulled from CYBORG master on activation)
ENV
  chmod 600 ~/.config/tmmt/red-hood.env
fi
ok "Operator env written to ~/.config/tmmt/red-hood.env"

# ── STEP 7: CREDIT GUIDANCE TOOLS ────────────────────────
say "STEP 7 — Installing Red Hood credit guidance tools"
mkdir -p ~/.config/tmmt/credit-guidance

cat > ~/.config/tmmt/credit-guidance/guide.sh << 'GUIDE'
#!/usr/bin/env bash
# RED HOOD CREDIT GUIDANCE — Quick reference for Umar
# Usage: bash guide.sh [topic]
BD=$'\e[1m'; CY=$'\e[36m'; G=$'\e[32m'; X=$'\e[0m'
echo "${BD}${CY}RED HOOD — Credit Guidance Quick Reference${X}"
echo
echo "${BD}COMPLIANCE VOCABULARY (always use these words):${X}"
echo "  ✓ Say: 'credit guidance'   ✗ Never say: 'credit repair'"
echo "  ✓ Say: 'dispute assistance' ✗ Never say: 'fix your credit'"
echo "  ✓ Say: 'financial coaching' ✗ Never say: 'remove items'"
echo
echo "${BD}SCORE TIERS & STRATEGY:${X}"
echo "  300-549  Subprime    → 6-12 mo plan. Secured card + dispute errors first."
echo "  550-619  Near-prime  → 3-6 mo plan. Add authorized user. Pay down utilization."
echo "  620-679  Fair        → 1-3 mo plan. Rapid rescore eligible. Push for 680."
echo "  680+     Approval    → Ready for car + funding. Move fast."
echo
echo "${BD}FIRST CLIENT CALL CHECKLIST:${X}"
echo "  1. Pull all 3 bureaus (Experian/Equifax/TransUnion)"
echo "  2. Identify errors + negative items"
echo "  3. Check utilization (target: under 30%)"
echo "  4. Set 90-day milestone goal with client"
echo "  5. Log to TMMT OS → Credit Guidance section"
echo
GUIDE
chmod +x ~/.config/tmmt/credit-guidance/guide.sh

# ── Install one-word operator commands (idempotent) ──────
# Mirrors the operator word block in scripts/go so the words the operator
# guide promises (menu · work · sync · sos · dark · guide · watchtower ·
# compass · moe-brief · moe-hot) actually resolve after restarting the
# terminal. Fenced: no owner agents, no booyah/seal/wake here.
install_words() {
  local rc="$1" tmp
  tmp="$(mktemp)"
  [[ -e "$rc" ]] && grep -v 'TMMT_WORDS' "$rc" 2>/dev/null > "$tmp" || true
  {
    echo "# TMMT_WORDS (auto-managed by umar-setup.command — one word does the thing)"
    echo "alias guide='bash ~/.config/tmmt/credit-guidance/guide.sh'   # TMMT_WORDS"
    echo "alias tmmt='bash \"$INSTALL_DIR/scripts/tmmt\"'              # TMMT_WORDS"
    echo "alias menu='bash \"$INSTALL_DIR/scripts/menu\"'              # TMMT_WORDS"
    echo "alias compass='bash \"$INSTALL_DIR/scripts/compass\"'        # TMMT_WORDS"
    echo "alias watchtower='bash \"$INSTALL_DIR/scripts/watchtower\"'  # TMMT_WORDS"
    echo "alias dark='bash \"$INSTALL_DIR/scripts/godark\"'            # TMMT_WORDS"
    echo "alias light='bash \"$INSTALL_DIR/scripts/godark\" lift'      # TMMT_WORDS"
    echo "alias work='bash \"$INSTALL_DIR/scripts/tmmt\" go 2'         # TMMT_WORDS"
    echo "alias sync='bash \"$INSTALL_DIR/scripts/tmmt\" sync'         # TMMT_WORDS"
    echo "alias who='bash \"$INSTALL_DIR/scripts/tmmt\" who'           # TMMT_WORDS"
    echo "alias sos='bash \"$INSTALL_DIR/scripts/tmmt\" help'          # TMMT_WORDS"
    echo "alias moe-brief='bash \"$INSTALL_DIR/scripts/moe-brief\"'    # TMMT_WORDS"
    echo "alias moe-hot='bash \"$INSTALL_DIR/scripts/moe-hot\"'        # TMMT_WORDS"
  } >> "$tmp"
  mv "$tmp" "$rc"
}
touch ~/.zshrc ~/.bashrc 2>/dev/null || true
for rc in ~/.zshrc ~/.bashrc; do install_words "$rc"; done
ok "One-word commands installed: menu · work · sync · sos · dark · guide · watchtower · compass · moe-brief · moe-hot"

# ── STEP 8: TAILSCALE ────────────────────────────────────
say "STEP 8 — Tailscale mesh node"
if command -v tailscale &>/dev/null; then
  TS_IP=$(tailscale ip 2>/dev/null | head -1 || echo "")
  if [[ -n "$TS_IP" ]]; then
    ok "Already on Tailscale: $TS_IP"
  else
    warn "Tailscale installed but not connected. Run: sudo tailscale up"
    warn "Then share your Tailscale IP with Muhammad Taha to join the mesh."
  fi
else
  warn "Tailscale not installed."
  printf '  Install it at: https://tailscale.com/download\n'
  printf '  Then: sudo tailscale up --auth-key=<key Muhammad Taha sends you>\n'
fi

# ── STEP 9: HAILMARY LICENSE ─────────────────────────────
say "STEP 9 — HailMary license (activate via CYBORG)"
LICENSE_FILE="$HOME/.config/tmmt/hailmary-license.env"
if [[ -f "$LICENSE_FILE" ]]; then
  ok "HailMary license already installed."
  grep "TIER\|OPERATOR_NAME\|LICENSE_ID" "$LICENSE_FILE" | sed 's/^/  /'
else
  warn "No HailMary license found."
  printf '  Muhammad Taha needs to run activate.command from CYBORG on this machine.\n'
fi

# ── DONE ─────────────────────────────────────────────────
printf '\n%s%s' "$G$BD" "
  ══════════════════════════════════════════════
  RED HOOD STATION READY
  ══════════════════════════════════════════════
"
printf '%s' "$X"
printf '  Operator:   %s\n' "$OP_NAME"
printf '  Role:       Red Hood — Credit Guidance\n'
printf '  Vertical:   Credit Guidance (compliance vocab enforced)\n'
printf '  Watchtower: Muhammad Taha / AIXMOS\n\n'
printf '  Commands available after restarting terminal:\n'
printf '    menu      — your whole command board\n'
printf '    work      — start your assigned work\n'
printf '    sync      — pull/push the latest\n'
printf '    sos       — reach Muhammad Taha  (e.g. sos "stuck on intake")\n'
printf '    dark      — emergency stop\n'
printf '    guide     — credit guidance quick reference\n'
printf '    moe-brief — your daily briefing\n'
printf '    moe-hot   — your hottest leads + next action\n'
printf '    tmmt      — full operator dispatcher\n\n'
printf '  IMPORTANT: You are a fenced operator. You have access\n'
printf '  to credit guidance tools only. Owner authority is sealed.\n\n'
read -p "  Press ENTER to close."
