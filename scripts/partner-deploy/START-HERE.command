#!/bin/bash
# START-HERE.command — double-click entry point on the AIXMOS Partner USB.
# Routes to provision-partner.sh. Keeps the terminal window open on error.

set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<EOF

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║              A I X M O S   P A R T N E R   I N S T A L L         ║
║                                                                  ║
║  This will install the AIXMOS Partner stack on this Mac.         ║
║  Hardware will be pinned. License will be issued.                ║
║                                                                  ║
║  You must agree to the on-screen consent to proceed.             ║
║                                                                  ║
║  If you have ANY question — call ceo.moe BEFORE you continue.    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

Press ENTER to begin, or Ctrl-C to abort.
EOF
read -r _

bash "$HERE/provision-partner.sh" || {
  echo
  echo "Install FAILED. See messages above. The terminal will stay open."
  echo "Take a screenshot and send to ceo.moe."
  read -r _
  exit 1
}

echo
echo "Press ENTER to close this window."
read -r _
