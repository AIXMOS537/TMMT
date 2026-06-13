#!/usr/bin/env bash
# provision-partner.sh — main install. Runs on PARTNER'S Mac from the USB.
# Sourced by START-HERE.command.
#
# Idempotent: re-running after a successful install is a no-op except for re-loading
# launchd plists. Re-running after a partial install resumes from the failed step.
#
# Per spec §7: runs as the partner user, no sudo.

set -euo pipefail

# Where this script lives = USB root
USB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/Library/Application Support/aixmos-partner"
BIN_DIR="$INSTALL_DIR/bin"
CONFIG_DIR="$HOME/.config/tmmt"
CONFIG_FILE="$CONFIG_DIR/partner.env"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
LOG="$INSTALL_DIR/install.log"

# ANSI
g() { printf '\033[0;32m%s\033[0m\n' "$*"; }
r() { printf '\033[0;31m%s\033[0m\n' "$*"; }
y() { printf '\033[0;33m%s\033[0m\n' "$*"; }
hdr() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$CONFIG_DIR"
chmod 700 "$INSTALL_DIR" "$BIN_DIR" "$CONFIG_DIR"

logp() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2; }

# ---- 0. Pre-flight ----
hdr "0. Pre-flight"
[[ -f "$USB_ROOT/.partner-config" ]] || { r "Missing .partner-config on USB"; exit 1; }
[[ -f "$USB_ROOT/.install-token" ]]  || { r "Missing .install-token on USB"; exit 1; }
[[ -d "$USB_ROOT/partner-payload" ]] || { r "Missing partner-payload/ on USB"; exit 1; }
[[ -f "$USB_ROOT/consent/clickwrap.html" ]] || { r "Missing consent/clickwrap.html on USB"; exit 1; }

# Bail if already installed and active
if [[ -f "$INSTALL_DIR/.installed" ]]; then
  y "Already installed (per $INSTALL_DIR/.installed). Re-loading launchd plists only."
  for plist in tools.aixmos.partner.killswitch tools.aixmos.partner.heartbeat tools.aixmos.partner.audit; do
    launchctl unload "$LAUNCH_AGENTS/$plist.plist" 2>/dev/null || true
    launchctl load   "$LAUNCH_AGENTS/$plist.plist"
  done
  g "Reloaded. Done."
  exit 0
fi

# shellcheck disable=SC1091
source "$USB_ROOT/.partner-config"
INSTALL_TOKEN="$(< "$USB_ROOT/.install-token")"
TOKEN_HASH="$(printf '%s' "$INSTALL_TOKEN" | shasum -a 256 | cut -d' ' -f1)"

logp "starting install for tenant=$PARTNER_TENANT_ID partner=$PARTNER_NAME"

# ---- 1. Clickwrap consent ----
hdr "1. Clickwrap consent (you must agree to proceed)"
# Open the HTML in the default browser; partner clicks Install (or Decline)
# Browser exit doesn't tell us the answer — we use a tty fallback for v1.
y "Opened the consent page in your browser. Read it carefully."
open "$USB_ROOT/consent/clickwrap.html" || true
echo
echo "  In this terminal: type exactly 'I AGREE' to accept the consent."
echo "  Type anything else (or Ctrl-C) to abort the install."
echo
read -r AGREE_INPUT
if [[ "$AGREE_INPUT" != "I AGREE" ]]; then
  r "Consent NOT given. Aborting install."
  exit 1
fi
g "Consent recorded."

# Email a copy of the clickwrap + timestamp to the partner (queued; sent by audit shipper)
CONSENT_TS="$(date -u +%FT%TZ)"
echo "{\"event_ts\": \"$CONSENT_TS\", \"event_type\": \"consent_recorded\", \"event_data\": {\"partner_email\": \"$PARTNER_EMAIL\", \"clickwrap_sha256\": \"$(shasum -a 256 "$USB_ROOT/consent/clickwrap.html" | cut -d' ' -f1)\", \"ip_at_install\": \"$(curl -fsS ifconfig.me 2>/dev/null || echo unknown)\"}}" >> "$INSTALL_DIR/audit.ndjson"

# ---- 2. Attestation: hardware UUID + non-exportable keypair ----
hdr "2. Hardware attestation"
cp "$USB_ROOT/partner-payload/attestation.py" "$BIN_DIR/"
chmod 755 "$BIN_DIR/attestation.py"

ATTEST_JSON="$(/usr/bin/python3 "$BIN_DIR/attestation.py")"
HW_UUID="$(printf '%s' "$ATTEST_JSON" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["hardware_uuid"])')"
PUB_B64="$(printf '%s' "$ATTEST_JSON" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["pubkey_b64"])')"
g "Hardware UUID: $HW_UUID"

# ---- 3. Redeem one-time install token ----
hdr "3. Redeeming install token (one-shot)"
PUBLIC_IP="$(curl -fsS ifconfig.me 2>/dev/null || echo 0.0.0.0)"
REDEEM_PAYLOAD="$(/usr/bin/python3 -c "
import json
print(json.dumps({
  'p_token_hash': '$TOKEN_HASH',
  'p_hardware_uuid': '$HW_UUID',
  'p_enclave_pubkey': '$PUB_B64',
  'p_source_ip': '$PUBLIC_IP',
}))")"

REDEEM_RESP="$(curl -fsS -X POST \
  "$SUPABASE_URL/rest/v1/rpc/partner_redeem_install_token" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$REDEEM_PAYLOAD")"

RESULT="$(printf '%s' "$REDEEM_RESP" | /usr/bin/python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["result_code"] if d else "no_response")')"

case "$RESULT" in
  ok)
    g "Token redeemed. License bound to this Mac."
    ;;
  already_used)
    r "FAIL: install token has already been used."
    r "If this is unexpected, the USB may have been used on another Mac."
    r "Contact ceo.moe (owner) for a new flash drive."
    exit 1
    ;;
  expired)
    r "FAIL: install token has expired. Contact ceo.moe for a new flash drive."
    exit 1
    ;;
  unknown)
    r "FAIL: install token not recognized. Contact ceo.moe."
    exit 1
    ;;
  *)
    r "FAIL: unexpected response from server: $REDEEM_RESP"
    exit 1
    ;;
esac

# Burn the token on the USB (overwrite with garbage)
if [[ -w "$USB_ROOT/.install-token" ]]; then
  dd if=/dev/urandom of="$USB_ROOT/.install-token" bs=64 count=1 2>/dev/null || true
  : > "$USB_ROOT/.install-token"
  logp "burned install token on USB"
fi

# ---- 4. Tailscale ----
hdr "4. Tailscale (narrow tag:partner-$PARTNER_TENANT_ID lane)"
if command -v tailscale >/dev/null 2>&1; then
  TS_BIN="$(command -v tailscale)"
elif [[ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]]; then
  TS_BIN="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
else
  y "Tailscale CLI not found. Skipping tailnet join — partner can install later via:"
  y "  https://tailscale.com/download/mac"
  TS_BIN=""
fi

if [[ -n "$TS_BIN" && -f "$USB_ROOT/.tailscale-authkey" ]]; then
  TS_KEY="$(< "$USB_ROOT/.tailscale-authkey")"
  if "$TS_BIN" up --authkey="$TS_KEY" --advertise-tags="tag:partner-$PARTNER_TENANT_ID" --reset 2>&1 | tee -a "$LOG"; then
    g "Joined tailnet with tag:partner-$PARTNER_TENANT_ID"
  else
    y "Tailscale join failed. Not fatal — kill-switch + heartbeat still work over public REST."
  fi
  # Burn the tailscale auth key too
  : > "$USB_ROOT/.tailscale-authkey"
else
  y "No tailscale-authkey on USB. Skipping tailnet join."
fi

# ---- 5. Install partner payload ----
hdr "5. Installing partner agents"
cp "$USB_ROOT/partner-payload/kill-switch-agent.py" "$BIN_DIR/"
cp "$USB_ROOT/partner-payload/heartbeat.py" "$BIN_DIR/"
cp "$USB_ROOT/partner-payload/audit-shipper.py" "$BIN_DIR/"
chmod 755 "$BIN_DIR"/*.py
g "Agents at $BIN_DIR (mode 700, partner-readable only)"

# ---- 6. Write partner config (mode 600) ----
hdr "6. Partner config"
cat > "$CONFIG_FILE" <<EOF
PARTNER_TENANT_ID="$PARTNER_TENANT_ID"
PARTNER_NAME="$PARTNER_NAME"
PARTNER_EMAIL="$PARTNER_EMAIL"
SUPABASE_URL="$SUPABASE_URL"
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
OWNER_EMAIL="$OWNER_EMAIL"
EOF
chmod 600 "$CONFIG_FILE"
g "Config at $CONFIG_FILE (mode 600)"

# ---- 7. Install launchd plists ----
hdr "7. launchd agents"
mkdir -p "$LAUNCH_AGENTS"
for plist in tools.aixmos.partner.killswitch tools.aixmos.partner.heartbeat tools.aixmos.partner.audit; do
  SRC="$USB_ROOT/partner-payload/launchd/$plist.plist"
  DST="$LAUNCH_AGENTS/$plist.plist"
  sed -e "s|__INSTALL_DIR__|$BIN_DIR|g" -e "s|__HOME__|$HOME|g" "$SRC" > "$DST"
  launchctl unload "$DST" 2>/dev/null || true
  launchctl load "$DST"
  g "Loaded: $plist"
done

# ---- 8. First heartbeat (synchronous) ----
hdr "8. First heartbeat"
if /usr/bin/python3 "$BIN_DIR/heartbeat.py"; then
  g "First heartbeat OK"
else
  y "First heartbeat failed. Will retry on next scheduled run."
fi

# ---- 9. First kill-switch poll (synchronous) ----
hdr "9. First kill-switch poll"
if /usr/bin/python3 "$BIN_DIR/kill-switch-agent.py"; then
  g "First kill-switch poll OK"
else
  y "First kill-switch poll failed. Will retry every 15 min."
fi

# ---- 10. Web shortcuts (v1: browser instead of native Tauri app) ----
hdr "10. App shortcuts"
APPS_DIR="$HOME/Applications"
mkdir -p "$APPS_DIR"
cat > "$APPS_DIR/AIXMOS Partner.webloc" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>https://tmmt-ops.vercel.app/partner?t=$PARTNER_TENANT_ID</string>
</dict>
</plist>
EOF
g "Shortcut: ~/Applications/AIXMOS Partner.webloc"

# ---- 11. Done ----
touch "$INSTALL_DIR/.installed"
chmod 400 "$INSTALL_DIR/.installed"

hdr "11. Install complete"
g "AIXMOS Partner is installed."
echo
echo "  - Heartbeat: every 24h to Supabase"
echo "  - Audit ship: every 1h"
echo "  - Kill-switch poll: every 15 min"
echo "  - Open the app:  open ~/Applications/'AIXMOS Partner.webloc'"
echo "  - Uninstall:     run ./uninstall.sh from this USB (any time)"
echo
echo "  Your recovery challenge phrase was shared verbally by ceo.moe. Save it somewhere"
echo "  safe (1Password, written note). You'll need it if your Mac is ever lost or stolen."
echo
logp "install complete"
