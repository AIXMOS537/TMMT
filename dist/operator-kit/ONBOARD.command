#!/usr/bin/env bash
# ============================================================
# AIXMOS OPERATOR STATION — plug-and-play onboarding (macOS / Linux)
# Powered by PROJECT X AIXMOS.
#
# Send this ONE file to the person. They double-click it (Mac) or run:
#     bash ONBOARD.command
#
# It sets their machine up as a MANAGED AIXMOS OPERATOR STATION:
#   • installs the operator command kit (the one-word commands + local brain hooks)
#   • joins PROJECT X AIXMOS's private network (you approve the device)
#   • registers them as a FENCED operator (no owner keys, license-gated by you)
#
# CONSENT-FIRST BY DESIGN. It tells them exactly what it does and won't proceed
# until they accept. That transparency is what keeps this clean and legal —
# they choose to run on your stack; you stay the backbone and hold the keys.
# ============================================================
set -uo pipefail
REPO_URL="${AIXMOS_REPO:-https://github.com/AIXMOS537/TMMT.git}"
INSTALL_DIR="$HOME/AIXMOS-OPERATOR"
PHRASE="I JOIN THE NETWORK"
RED=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; CY=$'\e[36m'; BD=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
warn(){ printf '%s  ⚠ %s%s\n' "$Y" "$*" "$X"; }
say(){ printf '\n%s%s%s\n' "$BD" "$*" "$X"; }

clear 2>/dev/null || true
printf '%s\n' "$CY$BD
   ╔═╗╦╔═╗╔╦╗╔═╗╔═╗   ╔═╗╔═╗╔═╗╦═╗╔═╗╔╦╗╔═╗╦═╗
   ╠═╣║╔╩╦╝║║║║ ║╚═╗   ║ ║╠═╝║╣ ╠╦╝╠═╣ ║ ║ ║╠╦╝
   ╩ ╩╩╩ ╚═╩ ╩╚═╝╚═╝   ╚═╝╩  ╚═╝╩╚═╩ ╩ ╩ ╚═╝╩╚═
$X"
printf '   Operator Station · Powered by PROJECT X AIXMOS\n\n'

# ── CONSENT GATE — no covert anything ─────────────────────
say "WHAT THIS DOES (read before you continue)"
cat <<'M'
  This turns THIS computer into a managed AIXMOS Operator Station. It will:
    • install the operator toolkit (one-word commands + local AI brain hooks)
    • connect this machine to PROJECT X AIXMOS's private, encrypted network
      (the owner approves your device before it can join)
    • register you as a FENCED operator — you can work and earn; the owner
      provides updates, support, and licensing and can disable access

  It does NOT take your passwords, read your personal files, or hide anything.
  You are choosing to run your business on this stack. You can stop now.
M
printf '\n  Type exactly  %s%s%s  to continue (or anything else to cancel):\n  > ' "$BD" "$PHRASE" "$X"
IFS= read -r reply
[ "$(printf '%s' "$reply" | tr '[:lower:]' '[:upper:]' | xargs)" = "$PHRASE" ] || { printf '\n  Cancelled. Nothing was changed.\n\n'; exit 0; }

# ── IDENTITY ──────────────────────────────────────────────
say "STEP 1 — Who are you?"
read -p "  First name: " OP_NAME
read -p "  Email:      " OP_EMAIL
ok "Welcome, ${OP_NAME:-operator}."

# ── TOOLING ───────────────────────────────────────────────
say "STEP 2 — Checking tools"
MISS=0; for t in git curl; do command -v "$t" >/dev/null 2>&1 && ok "$t" || { warn "$t missing — install it then re-run"; MISS=1; }; done
[ "$MISS" = 1 ] && { printf '\n  Install the missing tool(s) and run this again.\n\n'; exit 1; }

# ── INSTALL THE OPERATOR KIT ──────────────────────────────
say "STEP 3 — Installing the operator kit"
if [ -d "$INSTALL_DIR/.git" ]; then ( cd "$INSTALL_DIR" && git pull --rebase --quiet 2>/dev/null ); ok "Updated $INSTALL_DIR";
else git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1 && ok "Installed to $INSTALL_DIR" || { warn "Clone failed — check internet / repo access"; exit 1; }; fi
cd "$INSTALL_DIR"

# ── FENCED OPERATOR IDENTITY ──────────────────────────────
say "STEP 4 — Registering you as a fenced operator"
mkdir -p .swarm
echo "operator-$(printf '%s' "${OP_NAME:-op}" | tr '[:upper:] ' '[:lower:]-')" > .swarm/machine
echo "operator" > .swarm/role
git config user.name  "${OP_NAME:-operator}" 2>/dev/null || true
git config user.email "${OP_EMAIL:-operator@aixmos}" 2>/dev/null || true
git config core.hooksPath scripts/hooks 2>/dev/null || true
ok "Role: operator (fenced) — owner authority stays with PROJECT X AIXMOS"

# ── ONE-WORD COMMANDS (the fixed word block) ──────────────
say "STEP 5 — Installing your one-word commands"
install_words(){ local rc="$1" tmp; tmp="$(mktemp)"; [ -e "$rc" ] && grep -v 'AIXMOS_WORDS' "$rc" 2>/dev/null > "$tmp" || true
  { echo "# AIXMOS_WORDS"
    for w in menu compass watchtower; do echo "alias $w='bash \"$INSTALL_DIR/scripts/$w\"'  # AIXMOS_WORDS"; done
    echo "alias dark='bash \"$INSTALL_DIR/scripts/godark\"'        # AIXMOS_WORDS"
    echo "alias work='bash \"$INSTALL_DIR/scripts/tmmt\" go 2'     # AIXMOS_WORDS"
    echo "alias sync='bash \"$INSTALL_DIR/scripts/tmmt\" sync'     # AIXMOS_WORDS"
    echo "alias sos='bash \"$INSTALL_DIR/scripts/tmmt\" help'      # AIXMOS_WORDS"
    echo "alias tmmt='bash \"$INSTALL_DIR/scripts/tmmt\"'          # AIXMOS_WORDS"; } >> "$tmp"; mv "$tmp" "$rc"; }
touch ~/.zshrc ~/.bashrc 2>/dev/null || true
for rc in ~/.zshrc ~/.bashrc; do install_words "$rc"; done
ok "Commands ready (open a new terminal): menu · work · sync · sos · dark · compass"

# ── JOIN THE NETWORK (owner-approved) ─────────────────────
say "STEP 6 — Join PROJECT X AIXMOS's network"
if command -v tailscale >/dev/null 2>&1; then ok "Tailscale present — run: sudo tailscale up   (owner approves your device)";
else warn "Install Tailscale: https://tailscale.com/download — then the owner approves your device."; fi

# ── PROFILE + SEND-BACK (owner activates) ─────────────────
say "STEP 7 — Send your profile back to the owner to activate"
PROF="$HOME/Desktop/AIXMOS-operator-${OP_NAME:-op}.txt"
{ echo "AIXMOS OPERATOR PROFILE"; echo "name:  ${OP_NAME:-}"; echo "email: ${OP_EMAIL:-}";
  echo "machine: $(hostname 2>/dev/null)"; echo "joined: $(date -u +%FT%TZ)"; echo "role: operator (fenced)";
  echo "status: AWAITING OWNER ACTIVATION (license + device approval)"; } > "$PROF"
ok "Saved: $PROF"

printf '\n%s%s' "$G$BD" "  ════════════════════════════════════════════
  OPERATOR STATION READY (pending activation)
  ════════════════════════════════════════════$X\n"
printf '  1. Send %s back to the owner.\n' "$PROF"
printf '  2. Owner approves your device + activates your license.\n'
printf '  3. Open a new terminal and type: %smenu%s\n\n' "$BD" "$X"
printf '%s  You are a fenced operator on PROJECT X AIXMOS. Owner holds the keys.%s\n\n' "$D" "$X"
read -p "  Press ENTER to close." _ 2>/dev/null || true
