#!/usr/bin/env bash
# Send one iMessage via Messages.app (Mac must be signed into iMessage).
# Usage: IMESSAGE_BUDDY="+15551234567" imessage_send.sh "Your line of text"
# Buddy must match how the contact appears for iMessage in Messages (phone or email).

set -euo pipefail

BUDDY="${IMESSAGE_BUDDY:-}"
TEXT="${1:-}"

if [[ -z "$BUDDY" || -z "$TEXT" ]]; then
  echo "Usage: IMESSAGE_BUDDY='+1…' $0 \"message text\"" >&2
  exit 1
fi

osascript -e 'on run argv
  tell application "Messages"
    set s to first service whose service type is iMessage
    set b to buddy (item 1 of argv) of s
    send (item 2 of argv) to b
  end tell
end run' -- "$BUDDY" "$TEXT"
