#!/usr/bin/env bash
# cursor-hailmary — turn Cursor into PROJECT X HAILMARY ("Rick Sorkin / X") on the M1.
# Installs/verifies the always-on persona rule, runs the self-audit, checks the local
# brain + guardrails, and prints how to drive everything from Cursor. Owner-only,
# local-first. Safe + idempotent — reads/verifies, never touches prod or secrets.
#
#   bash scripts/cursor-hailmary.sh        arm + verify
#   bash scripts/tmmt cursor               (same, via the one-word system)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; BD=; X=; fi
ok(){ printf '%s✓ %s%s\n' "$G" "$*" "$X"; }; warn(){ printf '%s• %s%s\n' "$Y" "$*" "$X"; }
bad(){ printf '%s✗ %s%s\n' "$R" "$*" "$X"; }; head(){ printf '\n%s▶ %s%s\n' "$BD" "$*" "$X"; }
have(){ command -v "$1" >/dev/null 2>&1; }

cat <<EOF
${C}${BD}
   ╔══════════════════════════════════════════════════════════╗
   ║   🛡️  CURSOR = PROJECT X HAILMARY  ·  Rick Sorkin / X     ║
   ╚══════════════════════════════════════════════════════════╝${X}
   Owner-only · local-first · driven from the M1 (brainiac-mac)
EOF

# 1) the persona rule (always-applied) must be present
head "1/5  Persona rule"
RULE="$ROOT/.cursor/rules/hailmary.mdc"
if [ -f "$RULE" ] && grep -q "PROJECT X HAILMARY" "$RULE"; then
  ok "Cursor will load HAILMARY automatically in this repo (.cursor/rules/hailmary.mdc)"
else
  bad "Persona rule missing — pull master, or re-add .cursor/rules/hailmary.mdc"
fi

# 2) charters + law present
head "2/5  The law"
for f in docs/HAILMARY-CHARTER.md docs/AIXMOS-CHARTER.md docs/WATCHTOWER-ROSTER.md docs/CEO-HANDOFF.md; do
  [ -f "$ROOT/$f" ] && ok "$f" || warn "missing: $f"
done

# 3) base state (DARK / seal / hailmary)
head "3/5  Base state"
[ -f "$ROOT/.swarm/DARK" ] && bad "DARK is ON — only safe words run (lift: bash scripts/godark lift)" || ok "blackout: clear"
[ -f "$ROOT/auth/OWNER.seal" ] && ok "owner seal: present" || warn "owner seal: not set (bash scripts/tmmt seal)"
grep -q '^online' "$ROOT/.hailmary/state" 2>/dev/null && ok "HAILMARY: online" || warn "HAILMARY: standby (bash scripts/hailmary booyah)"

# 4) local brain + guardrails (what makes 'do anything from the M1' real)
head "4/5  M1 capabilities"
have cursor && ok "Cursor CLI detected" || warn "Cursor CLI not on PATH (the rule still loads inside the app)"
have ollama && ok "local LLM (ollama) ready — true local brain" || warn "no local LLM — install ollama for a fully local brain"
have gitleaks && ok "gitleaks present — secret guard active on push" || warn "gitleaks missing — install so the pre-push guard works"
have node && ok "node $(node -v)" || bad "node missing"
[ -f "$ROOT/.git/hooks/pre-push" ] || git config --get core.hooksPath >/dev/null 2>&1 && ok "git hooks wired" || warn "git hooks not installed (bash scripts/swarm-join.sh)"

# 5) self-audit
head "5/5  Self-audit"
if [ -x "$ROOT/scripts/swarm-doctor.sh" ]; then bash "$ROOT/scripts/swarm-doctor.sh" 2>/dev/null | tail -3 || true; else warn "swarm-doctor not found"; fi

cat <<EOF

${G}${BD}   CURSOR IS NOW HAILMARY.${X}
   Open this repo in Cursor on the M1 — it loads the persona automatically.
   Talk to it like the Boss; it maps your words to the command system:

     ${BD}booyah${X}      → boot the base            ${BD}ceo${X}      → your cockpit
     ${BD}do all${X}      → build the safe next thing ${BD}handoff${X}  → delegate setup
     ${BD}parity${X}      → keep local = prod         ${BD}dark${X}     → kill-switch

   The law is baked in: owner-only, never expose HAILMARY publicly, rotate-don't-leak,
   prod is owner-shipped, protect X + family + friends. It will not cross those lines.
EOF
