#!/usr/bin/env bash
# burn-partner-usb.sh — copy all partner-deploy files + the per-partner
# issued bundle onto a USB drive mounted at /Volumes/AIXMOS-PARTNER (default).
#
# Run AFTER issue-license.sh has produced ./_issued/<partner>/
#
# Usage:
#   ./burn-partner-usb.sh --partner=moe-legacy [--volume=/Volumes/AIXMOS-PARTNER] [--tailscale-authkey=tskey-...]
#
# This script does NOT format the drive — format it as exFAT or APFS in Disk
# Utility first, and name it AIXMOS-PARTNER. The script just copies the
# right files into the right places and burns the install token on success.

set -euo pipefail

PARTNER=""
VOLUME="/Volumes/AIXMOS-PARTNER"
TS_KEY=""

for arg in "$@"; do
  case "$arg" in
    --partner=*)            PARTNER="${arg#*=}";;
    --volume=*)             VOLUME="${arg#*=}";;
    --tailscale-authkey=*)  TS_KEY="${arg#*=}";;
    *) echo "Unknown arg: $arg" >&2; exit 64;;
  esac
done

[[ -z "$PARTNER" ]] && { echo "Required: --partner=<name>" >&2; exit 64; }
[[ -d "$VOLUME" ]] || { echo "FAIL: USB not mounted at $VOLUME" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISSUED="$ROOT/_issued/$PARTNER"
[[ -d "$ISSUED" ]] || { echo "FAIL: no issued bundle at $ISSUED (run owner/issue-license.sh first)" >&2; exit 1; }

LEGAL="$HOME/Documents/Business/legal/moe-legacy"
[[ -d "$LEGAL" ]] || { echo "FAIL: legal dir missing at $LEGAL" >&2; exit 1; }

echo "==> Burning USB for partner '$PARTNER' at $VOLUME"

# Refuse to clobber a partner's drive if it already has someone else's payload
if [[ -f "$VOLUME/.partner-config" ]]; then
  EXISTING="$(grep -m1 PARTNER_TENANT_ID "$VOLUME/.partner-config" | cut -d= -f2 | tr -d '"' || echo unknown)"
  if [[ "$EXISTING" != "$PARTNER" ]]; then
    echo "FAIL: USB already contains config for tenant '$EXISTING' — wipe drive before reusing." >&2
    exit 1
  fi
fi

# Copy the runnable layer
cp -v "$ROOT/START-HERE.command"          "$VOLUME/"
cp -v "$ROOT/provision-partner.sh"        "$VOLUME/"
cp -v "$ROOT/uninstall.sh"                "$VOLUME/"
chmod +x "$VOLUME/START-HERE.command" "$VOLUME/provision-partner.sh" "$VOLUME/uninstall.sh"

# Copy partner payload (Python + launchd plists)
mkdir -p "$VOLUME/partner-payload/launchd"
cp -v "$ROOT/partner-payload/"*.py        "$VOLUME/partner-payload/"
cp -v "$ROOT/partner-payload/launchd/"*.plist "$VOLUME/partner-payload/launchd/"

# Copy consent UI
mkdir -p "$VOLUME/consent"
cp -v "$ROOT/consent/clickwrap.html"      "$VOLUME/consent/"

# Copy the per-partner config + token + (optional) tailscale key
cp -v "$ISSUED/partner-config.env"        "$VOLUME/.partner-config"
cp -v "$ISSUED/install-token.txt"         "$VOLUME/.install-token"
if [[ -n "$TS_KEY" ]]; then
  echo "$TS_KEY" > "$VOLUME/.tailscale-authkey"
  chmod 600 "$VOLUME/.tailscale-authkey"
fi

# Copy legal v0 drafts to /legal/ on the USB (visible browse-able copies)
mkdir -p "$VOLUME/legal"
cp -v "$LEGAL/master-partner-agreement.md" "$VOLUME/legal/"
cp -v "$LEGAL/dpa.md"                      "$VOLUME/legal/"
cp -v "$LEGAL/aup.md"                      "$VOLUME/legal/"

# Add a tiny README so partner knows what they're looking at
cat > "$VOLUME/README.txt" <<EOF
AIXMOS PARTNER USB — $PARTNER

To install: double-click START-HERE.command in this folder.

What you'll be asked:
  1. To read and agree to the install consent
  2. To type "I AGREE" in the terminal

The install takes 2-3 minutes. Don't close the terminal until it says
"Install complete."

If anything goes wrong, take a screenshot and call ceo.moe.

Legal v0 drafts are in /legal/ on this drive. Please review the
master-partner-agreement.md before installing.
EOF

# Final check
echo
echo "==> USB contents:"
ls -la "$VOLUME/"
echo
echo "==> $VOLUME is ready to ship to $PARTNER."
echo "    DO NOT REUSE this USB on another partner without reformatting."
echo
echo "Next: hand-deliver if possible; mail signature-required if not."
echo "      Call $PARTNER with the recovery challenge phrase BEFORE the USB arrives."
echo "      Phrase is at: $ISSUED/RECOVERY-PHRASE.txt"
