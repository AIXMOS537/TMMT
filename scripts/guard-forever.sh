#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  guard-forever.sh — ONE SHOT. Activate AND prove the secret guard on
#  THIS machine, forever and always.
#
#  God first. Then the Owner (Muhammad Taha). Then this machine.
#  Deen · Duniya · Akhira — nothing that could cost him money, his life,
#  or his family ever leaves this repo.
#
#  Run once on every device that touches the repo (Carry, M1, BRAINIAC).
#  Idempotent + reversible: re-run anytime — it only ever turns the guard ON.
#  Windows: run this in Git Bash.
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)" || exit 1

green(){ printf '\e[32m%s\e[0m\n' "$*"; }
red(){   printf '\e[31m%s\e[0m\n' "$*"; }

BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
echo "═══ GUARD-FOREVER · $(hostname) · branch $BR ═══"

# 1) Activate the canonical guard (blocks .env/keys/service-role/Stripe/GHL at commit).
git config core.hooksPath scripts/hooks
HP="$(git config core.hooksPath || true)"
if [[ "$HP" == "scripts/hooks" ]]; then green "✓ guard active: core.hooksPath = $HP"
else red "✗ could not set core.hooksPath"; exit 1; fi

# 2) Confirm the hook files exist and are executable.
for h in pre-commit pre-push; do
  if [[ -x "scripts/hooks/$h" ]]; then green "✓ scripts/hooks/$h present"
  else red "✗ scripts/hooks/$h missing or not executable"; exit 1; fi
done

# 3) LIVE PROOF — plant a fake secret; it MUST be blocked. Never trust an
#    unproven guard. Touches only our test file, never your other work.
TOP="$(git rev-parse --show-toplevel)"
tmp="$TOP/.env.guardtest"
# Assemble the trigger at RUNTIME so this source file doesn't itself trip the guard.
knm="SUPABASE_SERVICE_ROLE"
printf '%s_KEY=PLANTED_FAKE_FOR_SELFTEST\n' "$knm" > "$tmp"
git add -f "$tmp" 2>/dev/null
if git commit -m "guard self-test (must be blocked)" >/dev/null 2>&1; then
  red "✗ DANGER: guard did NOT block a planted secret. Do NOT commit here until fixed."
  git reset -q --soft HEAD~1 2>/dev/null || true
  git reset -q -- "$tmp" 2>/dev/null || true
  rm -f "$tmp"; echo "═══ NOT sealed — investigate above. ═══"; exit 1
else
  green "✓ PROOF: guard blocked a planted fake secret."
  git reset -q -- "$tmp" 2>/dev/null || true
  rm -f "$tmp"
fi

echo ""
green "═══ ONE SHOT — this machine is sealed. Forever and always. ═══"
