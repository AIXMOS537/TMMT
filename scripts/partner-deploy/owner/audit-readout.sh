#!/usr/bin/env bash
# Pull audit events for a partner. Owner-side only.
#
# Usage:
#   ./owner/audit-readout.sh --partner=moe-legacy --last=24h
#   ./owner/audit-readout.sh --partner=moe-legacy --last=72h --type=kill_soft
#   ./owner/audit-readout.sh --partner=moe-legacy --last=7d > evidence.json

set -euo pipefail

PARTNER=""
LAST="24h"
TYPE=""

for arg in "$@"; do
  case "$arg" in
    --partner=*) PARTNER="${arg#*=}";;
    --last=*)    LAST="${arg#*=}";;
    --type=*)    TYPE="${arg#*=}";;
    *) echo "Unknown arg: $arg" >&2; exit 64;;
  esac
done

[[ -z "$PARTNER" ]] && { echo "Required: --partner=<name>" >&2; exit 64; }

CONFIG="$HOME/.config/tmmt/partner-deploy.env"
# shellcheck disable=SC1090
source "$CONFIG"

# Convert --last to a Postgres interval
case "$LAST" in
  *h) INTERVAL="${LAST%h} hours";;
  *d) INTERVAL="${LAST%d} days";;
  *m) INTERVAL="${LAST%m} minutes";;
  *)  echo "Unknown duration: $LAST (use Nh / Nd / Nm)" >&2; exit 64;;
esac

# Build the query
QUERY="partner_audit_events?tenant_id=eq.$PARTNER"
QUERY="$QUERY&received_at=gte.$(date -u -v-"${LAST%[hdm]}${LAST: -1:1}" +%FT%TZ 2>/dev/null || date -u +%FT%TZ)"
[[ -n "$TYPE" ]] && QUERY="$QUERY&event_type=eq.$TYPE"
QUERY="$QUERY&order=event_ts.desc"

curl -fsS "$SUPABASE_URL/rest/v1/$QUERY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept: application/json"
