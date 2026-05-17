#!/usr/bin/env bash
# Smoke test GHL sync on deployed TMMT OS (after vercel deploy + env vars set).
set -euo pipefail

# Ops app (key) — not the Rentals Portal URL
BASE_URL="${BASE_URL:-https://tmmt-ops.vercel.app}"
GHL_SECRET="${GHL_WEBHOOK_SECRET:-}"

echo "== GET /api/status =="
curl -sS "${BASE_URL}/api/status" | python3 -m json.tool 2>/dev/null || curl -sS "${BASE_URL}/api/status"
echo ""

PAYLOAD="$(dirname "$0")/../../AUTOMATIONS/WEBHOOKS/ghl_opportunity_stage_changed.example.json"
if [[ ! -f "$PAYLOAD" ]]; then
  PAYLOAD="$(dirname "$0")/../AUTOMATIONS/WEBHOOKS/ghl_opportunity_stage_changed.example.json"
fi
if [[ ! -f "$PAYLOAD" ]]; then
  echo "Using inline test payload."
  BODY='{"contact_id":"smoke_test_'$(date +%s)'","stage":"Booked","pipeline_name":"TMMT Rentals","contact":{"name":"Smoke Test","phone":"+15551234567"}}'
else
  BODY="$(cat "$PAYLOAD")"
fi

echo "== POST /api/webhooks/ghl =="
HDR=(-H "Content-Type: application/json")
if [[ -n "$GHL_SECRET" ]]; then
  HDR+=(-H "X-GHL-Secret: ${GHL_SECRET}")
else
  echo "(No GHL_WEBHOOK_SECRET — omit header only if env unset on server)"
fi

curl -sS -X POST "${BASE_URL}/api/webhooks/ghl" "${HDR[@]}" -d "$BODY" | python3 -m json.tool 2>/dev/null || curl -sS -X POST "${BASE_URL}/api/webhooks/ghl" "${HDR[@]}" -d "$BODY"
echo ""
echo "Next: open ${BASE_URL}/internal/sync → Approve the new row (login required)."
