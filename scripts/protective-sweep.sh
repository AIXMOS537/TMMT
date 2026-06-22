#!/usr/bin/env bash
# protective-sweep — read-only checks that protect the owner. No writes, no deploy.
# Run anytime: bash scripts/protective-sweep.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ok(){ printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*"; }
fail(){ printf '  \033[31m✗\033[0m %s\n' "$*"; }

echo "=== Protective sweep (read-only) ==="
echo ""

# 1. Secrets not tracked
if git ls-files --error-unmatch .env .env.local 2>/dev/null; then
  fail ".env or .env.local is tracked by git — rotate keys immediately"
else
  ok "No .env/.env.local tracked in git"
fi

# 2. Pre-commit hooks
if [[ "$(git config core.hooksPath 2>/dev/null)" == "scripts/hooks" ]]; then
  ok "Secret guard hooks installed (core.hooksPath=scripts/hooks)"
else
  warn "Secret guard hooks not active — run: bash scripts/swarm-join.sh"
fi

# 3. Auto-deploy robot (should be unloaded)
PLIST="$HOME/Library/LaunchAgents/com.tmmt.auto-deploy-prod.plist"
if launchctl list 2>/dev/null | grep -q "com.tmmt.auto-deploy-prod"; then
  fail "auto-deploy-prod LaunchAgent is LOADED — violates owner-gated deploy law"
  echo "      Fix: launchctl unload $PLIST"
else
  ok "auto-deploy-prod LaunchAgent not loaded"
fi

# 4. swarm-coord branch (noise)
if git ls-remote --heads origin swarm-coord 2>/dev/null | grep -q swarm-coord; then
  warn "swarm-coord branch still on remote (harmless if auto-deploy off, but clutter)"
else
  ok "swarm-coord branch absent from remote"
fi

# 5. Uncommitted secret-like patterns in staged files
if git diff --cached --name-only 2>/dev/null | xargs -I{} grep -lE 'service_role|SUPABASE_SERVICE|sk_live|ghl.*secret' {} 2>/dev/null; then
  fail "Staged files may contain secrets — unstage before commit"
else
  ok "No obvious secrets in staged diff"
fi

# 6. Moe Legacy readiness (code-only)
if [[ -f src/lib/verticals/registry.ts ]] && [[ -f scripts/provision-tenant-seat.mjs ]]; then
  ok "Moe Legacy vertical config + provision script present"
else
  warn "Moe Legacy vertical files missing"
fi

echo ""
echo "Owner-only actions (cannot automate from here):"
echo "  • GitHub: branch protection + 2FA + Secret Scanning"
echo "  • Tailscale: device audit + device approval"
echo "  • Twilio: 10DLC registration (Moe Legacy LLC)"
echo "  • Signed B2B contract before partner app access"
echo ""
