#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — OPERATOR ACTIVATION
# Run by Muhammad Taha ONLY when onboarding a new operator.
# Requires: master passphrase + operator details + internet.
# ============================================================

set -euo pipefail

# ── CONFIG ────────────────────────────────────────────────
SUPABASE_URL="https://uapxakmlwnpfsftfeezx.supabase.co"
WATCHTOWER_FUNCTION="https://uapxakmlwnpfsftfeezx.supabase.co/functions/v1/watchtower"
HEARTBEAT_INTERVAL_DAYS=7
LICENSE_FILE="$HOME/.config/tmmt/hailmary-license.env"
HEARTBEAT_PLIST="$HOME/Library/LaunchAgents/com.aixmos.hailmary.heartbeat.plist"

RED='\033[0;31m'; GREEN='\033[0;32m'; GOLD='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

header() {
  clear
  echo -e "${GOLD}${BOLD}"
  echo "  ██╗  ██╗ █████╗ ██╗██╗     ███╗   ███╗ █████╗ ██████╗ ██╗   ██╗"
  echo "  ██║  ██║██╔══██╗██║██║     ████╗ ████║██╔══██╗██╔══██╗╚██╗ ██╔╝"
  echo "  ███████║███████║██║██║     ██╔████╔██║███████║██████╔╝ ╚████╔╝ "
  echo "  ██╔══██║██╔══██║██║██║     ██║╚██╔╝██║██╔══██║██╔══██╗  ╚██╔╝  "
  echo "  ██║  ██║██║  ██║██║███████╗██║ ╚═╝ ██║██║  ██║██║  ██║   ██║   "
  echo "  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   "
  echo -e "${RESET}"
  echo -e "${BOLD}         PROJECT X — OPERATOR ACTIVATION TERMINAL${RESET}"
  echo -e "         ${CYAN}Watchtower controlled by Muhammad Taha / AIXMOS${RESET}"
  echo
}

step() { echo -e "${GOLD}▸ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
fail() { echo -e "${RED}✗ $1${RESET}"; exit 1; }
warn() { echo -e "${RED}⚠ $1${RESET}"; }

# ── STEP 0: MASTER PASSPHRASE ─────────────────────────────
header
step "MASTER AUTHENTICATION"
echo "  This activation requires the AIXMOS master passphrase."
echo "  Only Muhammad Taha knows this. Do not share."
echo
read -s -p "  Enter master passphrase: " MASTER_PASS
echo
echo

# Hash and verify against stored hash
PASS_HASH=$(echo -n "$MASTER_PASS" | shasum -a 256 | awk '{print $1}')
STORED_HASH_FILE="$(dirname "$0")/../master/.passhash"

if [[ -f "$STORED_HASH_FILE" ]]; then
  STORED_HASH=$(cat "$STORED_HASH_FILE")
  if [[ "$PASS_HASH" != "$STORED_HASH" ]]; then
    fail "Wrong passphrase. Access denied."
  fi
  ok "Passphrase verified."
else
  warn "No hash file found — running first-time setup."
  read -p "  Confirm: set this as the master passphrase? (yes/no): " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || fail "Aborted."
  mkdir -p "$(dirname "$0")/../master"
  echo "$PASS_HASH" > "$STORED_HASH_FILE"
  chmod 600 "$STORED_HASH_FILE"
  ok "Master passphrase set and stored."
fi
echo

# ── STEP 1: OPERATOR DETAILS ─────────────────────────────
step "OPERATOR DETAILS"
read -p "  Operator full name: " OP_NAME
read -p "  Operator email: " OP_EMAIL
read -p "  Operator phone: " OP_PHONE
read -p "  City / market: " OP_CITY
echo
echo "  Select price tier:"
echo "  [1] TASTE      — Demo / Free"
echo "  [2] STARTER    — \$97/month"
echo "  [3] OPERATOR   — Mid-tier"
echo "  [4] FLAGSHIP   — \$50K full stack"
read -p "  Tier (1-4): " TIER_NUM

case "$TIER_NUM" in
  1) TIER="taste";    TIER_LABEL="TASTE — Demo" ;;
  2) TIER="starter";  TIER_LABEL="STARTER — \$97/mo" ;;
  3) TIER="operator"; TIER_LABEL="OPERATOR — Mid-tier" ;;
  4) TIER="flagship"; TIER_LABEL="FLAGSHIP — \$50K Full Stack" ;;
  *) fail "Invalid tier." ;;
esac

echo
ok "Operator: $OP_NAME | $OP_CITY | $TIER_LABEL"
echo

# ── STEP 2: DEVICE FINGERPRINT ────────────────────────────
step "BINDING TO THIS MACHINE"
SERIAL=$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial/ {print $NF}' | head -1)
DEVICE_FINGERPRINT=$(echo "${SERIAL}$(hostname)" | shasum -a 256 | awk '{print $1}')
LICENSE_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
ACTIVATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

ok "Device fingerprint: ${DEVICE_FINGERPRINT:0:16}...${DEVICE_FINGERPRINT: -8}"
ok "License ID: $LICENSE_ID"
echo

# ── STEP 3: REGISTER IN WATCHTOWER ───────────────────────
step "REGISTERING IN WATCHTOWER"

# Load Supabase service key + revolving seed from the ENCRYPTED vault.
# Never read plaintext from the FAT32 drive. vault.sh open decrypts to RAM.
VAULT_SH="$(dirname "$0")/../master/vault.sh"
if [[ -f "$(dirname "$0")/../master/vault.enc" ]]; then
  step "UNLOCKING ENCRYPTED VAULT"
  eval "$(bash "$VAULT_SH" open)" || fail "Vault unlock failed."
  ok "Vault unlocked in memory."

  # Second factor: revolving authentication code
  read -p "  Enter current revolving code (from CYBORG or your phone): " RCODE
  if [[ -n "${HAILMARY_TOTP_SEED:-}" ]]; then
    python3 "$(dirname "$0")/../master/totp.py" verify "$HAILMARY_TOTP_SEED" "$RCODE" >/dev/null \
      && ok "Revolving code verified." \
      || fail "Wrong revolving code. Activation denied."
  fi
else
  warn "No encrypted vault found. Run: bash master/vault.sh init  (strongly recommended)"
  read -p "  Enter Supabase service role key (temporary): " SUPABASE_SERVICE_KEY
fi

PAYLOAD=$(cat <<JSON
{
  "license_id": "$LICENSE_ID",
  "operator_name": "$OP_NAME",
  "operator_email": "$OP_EMAIL",
  "operator_phone": "$OP_PHONE",
  "operator_city": "$OP_CITY",
  "tier": "$TIER",
  "device_fingerprint": "$DEVICE_FINGERPRINT",
  "activated_at": "$ACTIVATED_AT",
  "active": true,
  "paid_in_full": $([ "$TIER_NUM" == "4" ] && echo "true" || echo "false"),
  "heartbeat_interval_days": $HEARTBEAT_INTERVAL_DAYS
}
JSON
)

RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/hailmary_licenses" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$PAYLOAD" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [[ "$HTTP_CODE" == "201" ]]; then
  ok "Registered in watchtower."
else
  warn "Watchtower registration failed (HTTP $HTTP_CODE). License written locally — sync manually."
fi
echo

# ── STEP 4: WRITE LICENSE TO THIS MACHINE ────────────────
step "INSTALLING LICENSE ON THIS MACHINE"
mkdir -p "$(dirname "$LICENSE_FILE")"
cat > "$LICENSE_FILE" << ENV
# HAILMARY LICENSE — DO NOT EDIT OR SHARE
LICENSE_ID=$LICENSE_ID
OPERATOR_NAME=$OP_NAME
OPERATOR_EMAIL=$OP_EMAIL
TIER=$TIER
DEVICE_FINGERPRINT=$DEVICE_FINGERPRINT
ACTIVATED_AT=$ACTIVATED_AT
SUPABASE_URL=$SUPABASE_URL
ENV
chmod 600 "$LICENSE_FILE"
ok "License installed at $LICENSE_FILE"
echo

# ── STEP 5: INSTALL HEARTBEAT ─────────────────────────────
step "INSTALLING WATCHTOWER HEARTBEAT"
HEARTBEAT_SCRIPT="$HOME/.config/tmmt/hailmary-heartbeat.sh"

cat > "$HEARTBEAT_SCRIPT" << 'HEARTBEAT'
#!/usr/bin/env bash
# HAILMARY WATCHTOWER HEARTBEAT — auto-installed, do not remove
source "$HOME/.config/tmmt/hailmary-license.env" 2>/dev/null || exit 1

CURRENT_FINGERPRINT=$(echo "$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial/ {print $NF}' | head -1)$(hostname)" | shasum -a 256 | awk '{print $1}')

# Device tampering check
if [[ "$CURRENT_FINGERPRINT" != "$DEVICE_FINGERPRINT" ]]; then
  # Machine was cloned or transferred — suspend
  osascript -e 'display alert "HAILMARY: License suspended. Contact AIXMOS." buttons {"OK"} default button "OK"' 2>/dev/null
  exit 1
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/watchtower" \
  -H "Content-Type: application/json" \
  -d "{\"license_id\": \"${LICENSE_ID}\", \"fingerprint\": \"${CURRENT_FINGERPRINT}\", \"ts\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  --connect-timeout 10 --max-time 15)

if [[ "$RESPONSE" == "403" || "$RESPONSE" == "401" ]]; then
  # Watchtower revoked this license
  rm -f "$HOME/.config/tmmt/hailmary-license.env"
  osascript -e 'display alert "HAILMARY: Access revoked by AIXMOS. System offline." buttons {"OK"} default button "OK"' 2>/dev/null
  launchctl unload "$HOME/Library/LaunchAgents/com.aixmos.hailmary.heartbeat.plist" 2>/dev/null
fi
HEARTBEAT

chmod +x "$HEARTBEAT_SCRIPT"

# Install launchd plist (runs every 7 days)
cat > "$HEARTBEAT_PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.aixmos.hailmary.heartbeat</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${HEARTBEAT_SCRIPT}</string>
  </array>
  <key>StartInterval</key>
  <integer>604800</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/.config/tmmt/heartbeat.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/.config/tmmt/heartbeat-err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$HEARTBEAT_PLIST" 2>/dev/null || true
launchctl load "$HEARTBEAT_PLIST" 2>/dev/null
ok "Heartbeat installed — pings watchtower every 7 days."
echo

# ── STEP 6: DEPLOY TIER CONTENT ───────────────────────────
step "DEPLOYING TIER CONTENT ($TIER_LABEL)"
DEPLOY_SRC="$(dirname "$0")/../deploy/tier-${TIER_NUM}-${TIER}"
DEPLOY_DEST="$HOME/.config/tmmt/hailmary"
mkdir -p "$DEPLOY_DEST"

if [[ -d "$DEPLOY_SRC" ]]; then
  cp -r "$DEPLOY_SRC/." "$DEPLOY_DEST/"
  ok "Tier content deployed to $DEPLOY_DEST"
else
  warn "Tier content not found at $DEPLOY_SRC — deploy manually."
fi
echo

# ── DONE ──────────────────────────────────────────────────
echo -e "${GOLD}${BOLD}"
echo "  ═══════════════════════════════════════════════════"
echo "  ACTIVATION COMPLETE"
echo "  ═══════════════════════════════════════════════════${RESET}"
echo
echo -e "  Operator:    ${BOLD}$OP_NAME${RESET}"
echo -e "  Market:      ${BOLD}$OP_CITY${RESET}"
echo -e "  Tier:        ${BOLD}$TIER_LABEL${RESET}"
echo -e "  License ID:  ${CYAN}$LICENSE_ID${RESET}"
echo
echo "  This machine is now under AIXMOS watchtower."
echo "  Muhammad Taha can suspend or revoke at any time."
echo
read -p "  Press ENTER to close."
