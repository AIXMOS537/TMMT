#!/usr/bin/env bash
# Four-tier kill switch. Owner runs this on owner's Mac.
#
# Usage:
#   ./owner/kill-partner.sh --partner=moe-legacy --tier=soft
#   ./owner/kill-partner.sh --partner=moe-legacy --tier=hard --confirm="MOE LEGACY"
#   ./owner/kill-partner.sh --partner=moe-legacy --tier=restore
#   ./owner/kill-partner.sh --partner=moe-legacy --tier=status
#
# Tiers (spec §10):
#   soft    — flip licenses.active=false. Next heartbeat returns 410.       Reversible.
#   hard    — set kill_command='wipe'. Partner agent wipes local install.    NOT reversible.
#   legal   — set kill_command='legal_hold'. Apps refuse, preserve evidence.  Reversible.
#   restore — clear kill_command + set active=true.                          Use after soft.
#   status  — print current license state. Read-only.
#
# Spec §10 also names "heartbeat miss" as a tier — that one is automatic
# (server-side rule), not a button. Not in this script.

set -euo pipefail

PARTNER=""
TIER=""
CONFIRM=""
REASON="${REASON:-not specified}"

for arg in "$@"; do
  case "$arg" in
    --partner=*) PARTNER="${arg#*=}";;
    --tier=*)    TIER="${arg#*=}";;
    --confirm=*) CONFIRM="${arg#*=}";;
    --reason=*)  REASON="${arg#*=}";;
    *) echo "Unknown arg: $arg" >&2; exit 64;;
  esac
done

[[ -z "$PARTNER" || -z "$TIER" ]] && {
  echo "Required: --partner=<name> --tier=<soft|hard|legal|restore|status>" >&2
  exit 64
}

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

case "$TIER" in
  status)
    echo "==> Current license state for $PARTNER"
    api GET "partner_status_overview?tenant_id=eq.$PARTNER"
    echo
    exit 0
    ;;

  soft)
    echo "==> SOFT KILL: $PARTNER (license inactive; apps refuse on next heartbeat)"
    api PATCH "partner_licenses?tenant_id=eq.$PARTNER&active=eq.true" \
      -d "{\"active\": false, \"killed_at\": \"$(date -u +%FT%TZ)\", \"killed_by\": \"$OWNER_EMAIL\", \"killed_reason\": \"$REASON\"}" >/dev/null
    api POST "partner_audit_events" \
      -d "{\"tenant_id\": \"$PARTNER\", \"hardware_uuid\": \"owner-side\", \"event_ts\": \"$(date -u +%FT%TZ)\", \"event_type\": \"kill_soft\", \"event_data\": {\"by\": \"$OWNER_EMAIL\", \"reason\": \"$REASON\"}}" >/dev/null
    echo "==> Soft kill sent. Partner apps refuse on next heartbeat (≤24h)."
    echo "    Reverse with: ./owner/kill-partner.sh --partner=$PARTNER --tier=restore"
    ;;

  hard)
    if [[ "$CONFIRM" != "$(echo "$PARTNER" | tr '[:lower:]' '[:upper:]' | tr '-' ' ')" ]]; then
      echo "HARD KILL requires --confirm=\"$(echo "$PARTNER" | tr '[:lower:]' '[:upper:]' | tr '-' ' ')\"" >&2
      echo "This is IRREVERSIBLE. Partner will need a new flash drive to reinstall." >&2
      exit 64
    fi
    echo "==> HARD KILL: $PARTNER (wipe directive + license revoked + status=terminated)"
    api PATCH "partner_licenses?tenant_id=eq.$PARTNER" \
      -d "{\"active\": false, \"kill_command\": \"wipe\", \"killed_at\": \"$(date -u +%FT%TZ)\", \"killed_by\": \"$OWNER_EMAIL\", \"killed_reason\": \"$REASON\"}" >/dev/null
    api PATCH "partner_tenants?tenant_id=eq.$PARTNER" \
      -d "{\"status\": \"terminated\"}" >/dev/null
    api POST "partner_audit_events" \
      -d "{\"tenant_id\": \"$PARTNER\", \"hardware_uuid\": \"owner-side\", \"event_ts\": \"$(date -u +%FT%TZ)\", \"event_type\": \"kill_hard\", \"event_data\": {\"by\": \"$OWNER_EMAIL\", \"reason\": \"$REASON\"}}" >/dev/null
    echo "==> Hard kill sent. Partner agent wipes local install on next poll (≤15 min)."
    echo "    Now manually:"
    echo "      1. Revoke Tailscale node: https://login.tailscale.com/admin/machines"
    echo "      2. Rotate any shared Supabase keys if you suspect compromise"
    echo "      3. Pull final audit: ./owner/audit-readout.sh --partner=$PARTNER --last=72h > evidence-$PARTNER-$(date +%F).ndjson"
    ;;

  legal)
    echo "==> LEGAL HOLD: $PARTNER (apps refuse, no wipe, evidence preserved)"
    api PATCH "partner_licenses?tenant_id=eq.$PARTNER" \
      -d "{\"active\": false, \"kill_command\": \"legal_hold\", \"killed_at\": \"$(date -u +%FT%TZ)\", \"killed_by\": \"$OWNER_EMAIL\", \"killed_reason\": \"$REASON\"}" >/dev/null
    api POST "partner_audit_events" \
      -d "{\"tenant_id\": \"$PARTNER\", \"hardware_uuid\": \"owner-side\", \"event_ts\": \"$(date -u +%FT%TZ)\", \"event_type\": \"kill_legal_hold\", \"event_data\": {\"by\": \"$OWNER_EMAIL\", \"reason\": \"$REASON\"}}" >/dev/null
    echo "==> Legal hold sent."
    ;;

  restore)
    echo "==> RESTORE: $PARTNER (clear kill_command + active=true)"
    api PATCH "partner_licenses?tenant_id=eq.$PARTNER" \
      -d "{\"active\": true, \"kill_command\": null, \"killed_at\": null, \"killed_by\": null, \"killed_reason\": null}" >/dev/null
    api PATCH "partner_tenants?tenant_id=eq.$PARTNER&status=neq.terminated" \
      -d "{\"status\": \"active\"}" >/dev/null
    api POST "partner_audit_events" \
      -d "{\"tenant_id\": \"$PARTNER\", \"hardware_uuid\": \"owner-side\", \"event_ts\": \"$(date -u +%FT%TZ)\", \"event_type\": \"kill_restore\", \"event_data\": {\"by\": \"$OWNER_EMAIL\", \"reason\": \"$REASON\"}}" >/dev/null
    echo "==> Restore sent. Partner apps work again on next heartbeat (≤24h)."
    echo "    NOTE: this does NOT restore a hard-killed install — wipe is destructive."
    echo "          For hard-kill recovery, use: ./owner/recovery-flow.sh --partner=$PARTNER"
    ;;

  *)
    echo "Unknown tier: $TIER" >&2
    exit 64
    ;;
esac
