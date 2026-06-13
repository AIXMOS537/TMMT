#!/usr/bin/env bash
# Issue a partner license + one-time install token.
# Owner runs this on owner's Mac (NOT on partner's). Output is dropped onto the USB.
#
# Usage:
#   ./owner/issue-license.sh \
#     --partner=moe-legacy \
#     --partner-name="Moe Legacy" \
#     --partner-email="moe@moelegacy.example.com" \
#     --challenge-phrase="$(openssl rand -hex 6)"
#
# Outputs:
#   - <stdout>      : install token (one-time, paste this onto the USB as .install-token)
#   - <stdout>      : challenge phrase hash + plaintext (share plaintext with partner OOB)
#   - DB row in     : partner_tenants, partner_licenses, partner_install_tokens

set -euo pipefail

PARTNER=""
PARTNER_NAME=""
PARTNER_EMAIL=""
CHALLENGE=""

for arg in "$@"; do
  case "$arg" in
    --partner=*)         PARTNER="${arg#*=}";;
    --partner-name=*)    PARTNER_NAME="${arg#*=}";;
    --partner-email=*)   PARTNER_EMAIL="${arg#*=}";;
    --challenge-phrase=*) CHALLENGE="${arg#*=}";;
    *) echo "Unknown arg: $arg" >&2; exit 64;;
  esac
done

[[ -z "$PARTNER" || -z "$PARTNER_NAME" || -z "$PARTNER_EMAIL" || -z "$CHALLENGE" ]] && {
  echo "Required: --partner, --partner-name, --partner-email, --challenge-phrase" >&2
  exit 64
}

CONFIG="$HOME/.config/tmmt/partner-deploy.env"
# shellcheck disable=SC1090
source "$CONFIG"

# Generate random install token (32 bytes hex)
INSTALL_TOKEN="$(openssl rand -hex 32)"
TOKEN_HASH="$(printf '%s' "$INSTALL_TOKEN" | shasum -a 256 | cut -d' ' -f1)"
CHALLENGE_HASH="$(printf '%s' "$CHALLENGE" | shasum -a 256 | cut -d' ' -f1)"

api() {
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" "$SUPABASE_URL/rest/v1/$path" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    "$@"
}

echo "==> Upserting tenant row: $PARTNER"
api POST "partner_tenants" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d "$(cat <<JSON
{
  "tenant_id": "$PARTNER",
  "partner_name": "$PARTNER_NAME",
  "partner_email": "$PARTNER_EMAIL",
  "challenge_phrase_hash": "$CHALLENGE_HASH",
  "status": "pending"
}
JSON
)" >/dev/null

echo "==> Creating license row"
api POST "partner_licenses" \
  -d "$(cat <<JSON
{ "tenant_id": "$PARTNER", "active": true }
JSON
)" >/dev/null

echo "==> Issuing one-time install token (expires in 7 days)"
api POST "partner_install_tokens" \
  -d "$(cat <<JSON
{ "tenant_id": "$PARTNER", "token_hash": "$TOKEN_HASH" }
JSON
)" >/dev/null

# Output the bits that need to leave this script
OUT_DIR="$HOME/Projects/TMMT/scripts/partner-deploy/_issued/$PARTNER"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

cat > "$OUT_DIR/install-token.txt" <<EOF
$INSTALL_TOKEN
EOF
chmod 600 "$OUT_DIR/install-token.txt"

cat > "$OUT_DIR/partner-config.env" <<EOF
PARTNER_TENANT_ID="$PARTNER"
PARTNER_NAME="$PARTNER_NAME"
PARTNER_EMAIL="$PARTNER_EMAIL"
SUPABASE_URL="$SUPABASE_URL"
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
OWNER_EMAIL="$OWNER_EMAIL"
EOF
chmod 600 "$OUT_DIR/partner-config.env"

cat > "$OUT_DIR/RECOVERY-PHRASE.txt" <<EOF
Challenge phrase (share with $PARTNER_EMAIL OUT OF BAND — phone call, not email/SMS):

    $CHALLENGE

If you ever need to reinstall (lost or stolen Mac), the partner must repeat this
phrase verbatim before we'll issue a new install token.
EOF
chmod 600 "$OUT_DIR/RECOVERY-PHRASE.txt"

echo
echo "============================================================"
echo "  ISSUED $PARTNER"
echo "============================================================"
echo "  Output dir:      $OUT_DIR"
echo "  install-token:   $OUT_DIR/install-token.txt"
echo "  partner-config:  $OUT_DIR/partner-config.env"
echo "  recovery-phrase: $OUT_DIR/RECOVERY-PHRASE.txt (share OOB)"
echo "============================================================"
echo
echo "Next steps:"
echo "  1. Drop install-token.txt and partner-config.env onto USB as:"
echo "       /Volumes/AIXMOS-PARTNER/.install-token"
echo "       /Volumes/AIXMOS-PARTNER/.partner-config"
echo "  2. Call $PARTNER_NAME ($PARTNER_EMAIL) and read the challenge phrase aloud."
echo "  3. Hand USB to partner. They run START-HERE.command."
echo "  4. Verify install via ./owner/audit-readout.sh --partner=$PARTNER --last=1h"
