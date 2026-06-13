#!/usr/bin/env bash
# Pre-flight check before flashing a partner USB.
# Per spec §16-B: every item below MUST be true before the partner's drive ships.
#
# Usage:
#   ./owner/verify-readiness.sh --partner=moe-legacy [--strict]
#
# --strict mode causes any STUB item to fail the check (use this before Moe's
# real USB). Without --strict, STUB items log a warning and pass.

set -euo pipefail

PARTNER=""
STRICT=0
EXIT_CODE=0

for arg in "$@"; do
  case "$arg" in
    --partner=*) PARTNER="${arg#*=}";;
    --strict)    STRICT=1;;
    *) echo "Unknown arg: $arg" >&2; exit 64;;
  esac
done

[[ -z "$PARTNER" ]] && { echo "Required: --partner=<name>" >&2; exit 64; }

# Source secrets per feedback_secrets_outside_repo
CONFIG="$HOME/.config/tmmt/partner-deploy.env"
[[ -f "$CONFIG" ]] || { echo "FAIL: missing $CONFIG (see README for required vars)" >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"

green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
yel()   { printf '\033[0;33m%s\033[0m\n' "$*"; }

pass() { green "  PASS  $1"; }
fail() { red   "  FAIL  $1"; EXIT_CODE=1; }
stub() {
  if (( STRICT )); then
    red   "  FAIL  $1 (STUB — strict mode)"
    EXIT_CODE=1
  else
    yel "  STUB  $1 (will FAIL in --strict)"
  fi
}

echo "=== Pre-flight for partner: $PARTNER (strict=$STRICT) ==="

# ---- Required env vars ----
echo
echo "[1/8] Owner-side secrets"
for var in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY OWNER_EMAIL TAILSCALE_API_KEY; do
  if [[ -z "${!var:-}" ]]; then
    fail "$var unset"
  else
    pass "$var present"
  fi
done

# ---- Supabase reachable ----
echo
echo "[2/8] Supabase health"
if curl -fsS -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
       "$SUPABASE_URL/rest/v1/partner_tenants?select=tenant_id&limit=1" \
       -o /dev/null; then
  pass "REST reachable + partner_tenants exists"
else
  fail "REST unreachable or partner_tenants missing (apply sql/20260609_partner_tenancy.sql)"
fi

# ---- Tailscale ACL configured ----
echo
echo "[3/8] Tailscale ACL"
if curl -fsS -u "$TAILSCALE_API_KEY:" \
       "https://api.tailscale.com/api/v2/tailnet/-/acl" 2>/dev/null \
       | grep -q "tag:partner-$PARTNER"; then
  pass "tag:partner-$PARTNER present in ACL"
else
  stub "tag:partner-$PARTNER missing from Tailscale ACL"
fi

# ---- Subdomains provisioned (STUB — spec §16-B) ----
echo
echo "[4/8] Required subdomains"
for host in lic.tmmt.tools log.tmmt.tools partner.tmmt-ops.com; do
  if curl -fsS -o /dev/null -m 5 "https://$host/healthz" 2>/dev/null; then
    pass "$host reachable"
  else
    stub "$host not reachable (v1 routes through Supabase REST instead)"
  fi
done

# ---- Sealed binaries (STUB) ----
echo
echo "[5/8] Sealed binaries"
DMG="$HOME/Projects/TMMT/scripts/partner-deploy/_build/AIXMOS-Partner.dmg"
PKG="$HOME/Projects/TMMT/scripts/partner-deploy/_build/AIXMOS-Brain.pkg"
if [[ -f "$DMG" ]]; then pass "AIXMOS-Partner.dmg present"; else stub "AIXMOS-Partner.dmg not built (v1 ships .webloc shortcut)"; fi
if [[ -f "$PKG" ]]; then pass "AIXMOS-Brain.pkg present";    else stub "AIXMOS-Brain.pkg not built (v1 ships .py source under /usr/local/aixmos)"; fi

# ---- Legal v0 drafts committed ----
echo
echo "[6/8] Legal v0 drafts"
LEGAL_DIR="$HOME/Documents/Business/legal/moe-legacy"
for doc in master-partner-agreement.md dpa.md aup.md; do
  if [[ -f "$LEGAL_DIR/$doc" ]]; then
    pass "$doc present"
  else
    fail "$doc missing from $LEGAL_DIR (must commit before ship)"
  fi
done

# ---- Attorney engagement (DEFERRED per owner decision 2026-06-09) ----
echo
echo "[7/8] Attorney engagement"
TRACKER="$LEGAL_DIR/engagement-tracker.md"
if [[ -f "$TRACKER" ]] && grep -q "Retainer signed.*DONE\|Retainer signed.*✓" "$TRACKER" 2>/dev/null; then
  pass "Attorney retainer signed (per engagement-tracker.md)"
else
  # Owner explicitly chose to defer attorney engagement.
  # The v0 docs are permissive (either party can propose amendments at any time).
  # If you later want to require attorney before ship, change this to fail().
  stub "Attorney not engaged (deferred per owner decision; not a hard gate)"
fi

# ---- Clickwrap matches §16-A ----
echo
echo "[8/8] Clickwrap consent language"
CLICKWRAP="$HOME/Projects/TMMT/scripts/partner-deploy/consent/clickwrap.html"
if [[ -f "$CLICKWRAP" ]] && grep -q "does NOT record your screen" "$CLICKWRAP"; then
  pass "clickwrap.html includes §16-A transparency clause"
else
  fail "clickwrap.html missing or §16-A clause not present"
fi

echo
if (( EXIT_CODE )); then
  red "===== NOT READY TO SHIP $PARTNER USB ====="
else
  green "===== READY TO SHIP $PARTNER USB ====="
fi

exit $EXIT_CODE
