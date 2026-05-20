#!/usr/bin/env bash
# Smoke test all GHL live-sync webhook handlers (requires migration 0012).
set -euo pipefail

BASE_URL="${BASE_URL:-https://tmmt-ops.vercel.app}"
GHL_SECRET="${GHL_WEBHOOK_SECRET:-}"
WEBHOOKS_DIR="$(dirname "$0")/../../AUTOMATIONS/WEBHOOKS"
HDR=(--noproxy '*' -H "Content-Type: application/json")
if [[ -n "$GHL_SECRET" ]]; then
  HDR+=(-H "X-GHL-Secret: ${GHL_SECRET}")
fi

post() {
  local path="$1"
  local file="$2"
  echo ""
  echo "== POST ${path} =="
  if [[ -f "$file" ]]; then
    curl -sS -X POST "${BASE_URL}${path}" "${HDR[@]}" -d @"$file" | python3 -m json.tool 2>/dev/null \
      || curl -sS -X POST "${BASE_URL}${path}" "${HDR[@]}" -d @"$file"
  else
    echo "Missing $file"
    return 1
  fi
  echo ""
}

post "/api/webhooks/ghl/contact" "${WEBHOOKS_DIR}/ghl_contact_created.example.json"
post "/api/webhooks/ghl/form" "${WEBHOOKS_DIR}/ghl_form_submitted.example.json"
post "/api/webhooks/ghl/appointment" "${WEBHOOKS_DIR}/ghl_appointment_booked.example.json"
post "/api/webhooks/ghl" "${WEBHOOKS_DIR}/ghl_opportunity_stage_changed.example.json"

echo "Done. Check Supabase: ghl_contacts, ghl_form_submissions, ghl_appointments, crm_sync_records."
