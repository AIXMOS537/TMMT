#!/usr/bin/env bash
# tonight-go-live.sh — owner prep before first operators / ads (read-only + safe checks)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bold(){ printf "\033[1m%s\033[0m\n" "$*"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$*"; }
warn(){ printf "\033[33m!\033[0m %s\n" "$*"; }

bold "== AIXMOS Tonight Go-Live =="

bold "[1] Quarantine Downloads"
bash "$ROOT/scripts/quarantine-downloads.sh" || warn "quarantine had issues"

bold "[2] Device integrity"
bash "$ROOT/scripts/device-integrity.sh" && ok "integrity scan complete" || warn "review integrity report in .aixmos/"

bold "[3] Brain docs present"
for f in docs/OPERATOR-BRAIN.md docs/OPERATOR-AGENT-RULES.md docs/TONIGHT-ONBOARDING-GO-LIVE.md; do
  [ -f "$f" ] && ok "$f" || warn "missing $f"
done

bold "[4] Compliance spot-check (consumer-facing sample)"
if [ -f scripts/compliance-check.mjs ]; then
  node scripts/compliance-check.mjs docs/OPERATOR-BRAIN.md 2>/dev/null | tail -5 || true
else
  warn "compliance-check.mjs not found — skip"
fi

bold "[5] Operator provision (dry-run template)"
if [ -f scripts/provision-operators.mjs ]; then
  echo "  node scripts/provision-operators.mjs --email YOU@DOMAIN.com --role operator --dry-run"
else
  warn "provision-operators.mjs not found"
fi

echo
bold "Manual (cannot automate):"
warn "Rotate GHL / ClickUp tokens if ever pasted in chat"
warn "Supabase Dashboard → Auth → Leaked password protection → ON"
warn "FileVault ON on this Mac"
echo
ok "Read: docs/TONIGHT-ONBOARDING-GO-LIVE.md"
