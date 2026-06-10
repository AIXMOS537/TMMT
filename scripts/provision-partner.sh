#!/usr/bin/env bash
# scripts/provision-partner.sh
# Provision a new partner organization end-to-end:
#  1. Creates organization + organization_licenses rows via Supabase
#  2. Generates a one-time install token, stores its SHA-256 hash on the license row
#  3. Writes the raw token + slug to ~/Documents/Business/flash-kits/<slug>/_onetime/
#  4. Tells you the next manual steps (Twilio, Stripe, Meta BM)
#
# Requires: psql, openssl, jq, $SUPABASE_DB_URL env var set
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <partner_slug> <display_name> <license_tier:full_os|custom|rentals_app>"
  echo "Example: $0 jane_doe 'Jane Doe Capital' custom"
  exit 2
fi

SLUG="$1"
NAME="$2"
TIER="$3"
DB="${SUPABASE_DB_URL:?SUPABASE_DB_URL required (postgres://... connection string)}"

OUT_DIR="$HOME/Documents/Business/flash-kits/$SLUG/_onetime"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

INSTALL_TOKEN="$(openssl rand -hex 32)"
TOKEN_HASH="$(printf '%s' "$INSTALL_TOKEN" | shasum -a 256 | awk '{print $1}')"

echo "==> 1. Creating organization row"
ORG_JSON=$(psql "$DB" -t -A -F'|' <<SQL
INSERT INTO organizations (name, kind, vertical, partner_app_slug, plan_tier, billing_status, agent_name, llm_daily_cap_usd)
VALUES ('$NAME', 'partner', 'service_arbitrage'::org_vertical, '$SLUG', 'partner', 'active', 'Riley', 50)
ON CONFLICT (partner_app_slug) DO UPDATE SET name = EXCLUDED.name
RETURNING id;
SQL
)
ORG_ID=$(echo "$ORG_JSON" | head -1 | tr -d ' ')
echo "    organization_id = $ORG_ID"

echo "==> 2. Creating organization_licenses row with install_token_hash"
psql "$DB" >/dev/null <<SQL
INSERT INTO organization_licenses (organization_id, license_tier, modules, max_ventures, license_key_hash, install_token_hash, install_token_used, active)
VALUES ('$ORG_ID', '$TIER'::license_tier, ARRAY['agent_sales','partner_deploy','revenue_engine']::text[], 25, 'seed-$SLUG', '$TOKEN_HASH', false, true)
ON CONFLICT (organization_id) DO UPDATE SET
  install_token_hash = EXCLUDED.install_token_hash,
  install_token_used = false,
  active = true;
SQL

echo "==> 3. Writing one-time token to $OUT_DIR/"
echo "$INSTALL_TOKEN" > "$OUT_DIR/install-token.bin"
echo "$ORG_ID"        > "$OUT_DIR/organization-id.txt"
echo "$SLUG"          > "$OUT_DIR/partner-slug.txt"
chmod 600 "$OUT_DIR"/*

echo ""
echo "================================================================"
echo "  Partner provisioned: $NAME ($SLUG)"
echo "  Organization ID:     $ORG_ID"
echo "  License tier:        $TIER"
echo "  One-time token:      $OUT_DIR/install-token.bin"
echo "================================================================"
echo ""
echo "Next manual steps (per docs/runbooks/MASTER_OPERATOR_RUNBOOK.md):"
echo "  1. Have $NAME register their Twilio 10DLC campaign (1-4 weeks)"
echo "  2. After Twilio approved: psql \"\$SUPABASE_DB_URL\" -c \"UPDATE organizations SET twilio_inbound_number='+1XXXXXXXXXX' WHERE id='$ORG_ID'\""
echo "  3. Have $NAME create Stripe Payment Links per SKU; store webhook secret as STRIPE_WEBHOOK_SECRET_${SLUG^^/-/_}"
echo "  4. Have $NAME set up Cal.com event; store webhook secret as CAL_WEBHOOK_SECRET_${SLUG^^/-/_}"
echo "  5. When flash drive ready: copy ~/Projects/TMMT/flash-drive-source/ + $OUT_DIR/ contents to USB"
