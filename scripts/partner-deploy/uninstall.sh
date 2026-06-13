#!/usr/bin/env bash
# uninstall.sh — partner-initiated clean removal of AIXMOS Partner.
# This is the OPT-OUT path. We document it openly per partner-protection invariants.
#
# What it does:
#   - Unloads + removes the three launchd plists
#   - Removes ~/Library/Application Support/aixmos-partner/
#   - Removes ~/.config/tmmt/partner.env
#   - Removes ~/Applications/'AIXMOS Partner.webloc'
#   - tailscale logout
#   - Posts a final 'uninstall' audit event so we know
#
# What it does NOT do:
#   - Does NOT touch the partner's GHL or ClickUp data (we never had access)
#   - Does NOT delete the partner's other applications or files

set -euo pipefail

INSTALL_DIR="$HOME/Library/Application Support/aixmos-partner"
CONFIG="$HOME/.config/tmmt/partner.env"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

# Last audit event before we lose access
if [[ -f "$CONFIG" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG"
  curl -fsS -X POST \
    "$SUPABASE_URL/rest/v1/partner_audit_events" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$(cat <<JSON
{
  "tenant_id": "$PARTNER_TENANT_ID",
  "hardware_uuid": "$(ioreg -rd1 -c IOPlatformExpertDevice | awk -F'"' '/IOPlatformUUID/{print $4}')",
  "event_ts": "$(date -u +%FT%TZ)",
  "event_type": "uninstall_partner_initiated",
  "event_data": {"by": "$PARTNER_EMAIL"}
}
JSON
)" >/dev/null 2>&1 || true
fi

for plist in tools.aixmos.partner.killswitch tools.aixmos.partner.heartbeat tools.aixmos.partner.audit; do
  P="$LAUNCH_AGENTS/$plist.plist"
  launchctl unload "$P" 2>/dev/null || true
  [[ -f "$P" ]] && rm -f "$P"
done

if command -v tailscale >/dev/null 2>&1; then
  tailscale logout 2>/dev/null || true
elif [[ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]]; then
  /Applications/Tailscale.app/Contents/MacOS/Tailscale logout 2>/dev/null || true
fi

security delete-generic-password -s "tools.aixmos.partner.device" 2>/dev/null || true

rm -rf "$INSTALL_DIR"
rm -f  "$CONFIG"
rm -f  "$HOME/Applications/AIXMOS Partner.webloc"

echo "AIXMOS Partner uninstalled cleanly."
echo "Your GHL, ClickUp, and other apps were not touched."
