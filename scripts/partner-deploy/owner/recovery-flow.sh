#!/usr/bin/env bash
# 7-step recovery flow when partner's Mac is lost / stolen / dies.
# Implements spec §16 question 5.
#
# Usage:
#   ./owner/recovery-flow.sh --partner=moe-legacy

set -euo pipefail

PARTNER=""
for arg in "$@"; do
  case "$arg" in
    --partner=*) PARTNER="${arg#*=}";;
    *) echo "Unknown arg: $arg" >&2; exit 64;;
  esac
done

[[ -z "$PARTNER" ]] && { echo "Required: --partner=<name>" >&2; exit 64; }

CONFIG="$HOME/.config/tmmt/partner-deploy.env"
# shellcheck disable=SC1090
source "$CONFIG"

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

# Pull partner record
ROW="$(api GET "partner_tenants?tenant_id=eq.$PARTNER&select=*")"
if [[ "$ROW" == "[]" ]]; then
  echo "FAIL: no tenant '$PARTNER' in DB" >&2
  exit 1
fi
PARTNER_NAME="$(echo "$ROW" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["partner_name"])')"
PARTNER_EMAIL="$(echo "$ROW" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["partner_email"])')"
CHALLENGE_HASH="$(echo "$ROW" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["challenge_phrase_hash"])')"

cat <<EOF

================================================================
  RECOVERY FLOW for $PARTNER ($PARTNER_NAME)
================================================================

You are about to reissue a new install token. This means a NEW
Mac will be permitted to register against this tenant. The OLD
Mac (if it ever comes back online) will fail the hardware-UUID
check and self-disable.

EOF

# Step 1: identity verification
echo "STEP 1/7 — IDENTITY CHECK (out of band)"
echo "  Call $PARTNER_EMAIL on the phone. Ask for:"
echo "    a. The challenge phrase you gave them at first install."
echo "    b. The last 4 digits of the phone number on their partner contract."
read -p "  Did both check out? (yes/no): " ID_OK
[[ "$ID_OK" != "yes" ]] && { echo "Abort recovery."; exit 1; }

read -p "  Type the challenge phrase they spoke: " SPOKEN_PHRASE
SPOKEN_HASH="$(printf '%s' "$SPOKEN_PHRASE" | shasum -a 256 | cut -d' ' -f1)"
if [[ "$SPOKEN_HASH" != "$CHALLENGE_HASH" ]]; then
  echo "  FAIL: phrase hash mismatch. Either they didn't say it right, OR this is an"
  echo "        impersonation attempt. Abort recovery and contact ceo.moe directly."
  exit 1
fi
echo "  PASS: challenge phrase verified."

# Step 2: soft-kill old license (in case it ever phones home)
echo
echo "STEP 2/7 — SOFT-KILL THE OLD LICENSE"
"$(dirname "$0")/kill-partner.sh" --partner="$PARTNER" --tier=soft --reason="recovery — old Mac assumed compromised"

# Step 3: clear hardware UUID on the license row so a new Mac can bind
echo
echo "STEP 3/7 — CLEAR HARDWARE PIN"
api PATCH "partner_licenses?tenant_id=eq.$PARTNER" \
  -d "{\"hardware_uuid\": null, \"enclave_pubkey\": null, \"active\": true, \"kill_command\": null}" >/dev/null
echo "  Hardware pin cleared. New install can now bind."

# Step 4: rotate challenge phrase
echo
echo "STEP 4/7 — ROTATE CHALLENGE PHRASE"
NEW_PHRASE="$(openssl rand -hex 6)"
NEW_HASH="$(printf '%s' "$NEW_PHRASE" | shasum -a 256 | cut -d' ' -f1)"
api PATCH "partner_tenants?tenant_id=eq.$PARTNER" \
  -d "{\"challenge_phrase_hash\": \"$NEW_HASH\"}" >/dev/null
echo "  New challenge phrase: $NEW_PHRASE"
echo "  (You will share this OOB on the same call. Don't email or text.)"

# Step 5: issue new install token
echo
echo "STEP 5/7 — ISSUE NEW INSTALL TOKEN"
"$(dirname "$0")/issue-license.sh" \
  --partner="$PARTNER" \
  --partner-name="$PARTNER_NAME" \
  --partner-email="$PARTNER_EMAIL" \
  --challenge-phrase="$NEW_PHRASE"

# Step 6: audit
echo "STEP 6/7 — RECORD RECOVERY EVENT"
api POST "partner_audit_events" \
  -d "{\"tenant_id\": \"$PARTNER\", \"hardware_uuid\": \"owner-side\", \"event_ts\": \"$(date -u +%FT%TZ)\", \"event_type\": \"recovery_initiated\", \"event_data\": {\"by\": \"$OWNER_EMAIL\"}}" >/dev/null
echo "  Recovery event logged."

# Step 7: ship new USB
echo
echo "STEP 7/7 — SHIP A NEW USB"
echo "  1. Burn a fresh USB from ~/Projects/TMMT/scripts/partner-deploy/_issued/$PARTNER/"
echo "  2. Hand-deliver if possible. Mail if not (signature-required)."
echo "  3. Read the new challenge phrase to them on the call BEFORE the USB arrives."
echo
echo "  When their NEW Mac installs, its UUID will land in partner_licenses.hardware_uuid."
echo "  The audit log will show both UUIDs (old and new) — that's the paper trail."
echo
echo "DONE. Recovery flow complete for $PARTNER."
