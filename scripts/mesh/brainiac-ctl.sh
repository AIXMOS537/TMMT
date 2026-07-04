#!/usr/bin/env bash
# brainiac-ctl — from the M1, reach the heavy-compute node (brainiac) over the
# tailnet. X never touches Windows directly; Rick drives it from the Mac.
#   brainiac-ctl status   is it reachable?
#   brainiac-ctl up|wake  bring it online (WOL if configured), then confirm
set -uo pipefail
HOST="${BRAINIAC_HOST:-brainiac-win}"
verb="${1:-status}"

reachable() { tailscale ping -c1 --timeout 3s "$HOST" >/dev/null 2>&1; }

case "$verb" in
  status)
    if reachable; then echo "  ✓ $HOST reachable on the tailnet"; else echo "  ! $HOST offline"; fi
    ;;
  up|wake)
    if reachable; then echo "  ✓ $HOST already up"; exit 0; fi
    if [ -n "${BRAINIAC_MAC:-}" ] && command -v wakeonlan >/dev/null 2>&1; then
      wakeonlan "$BRAINIAC_MAC" >/dev/null 2>&1 && echo "  → wake-on-LAN sent to $HOST ($BRAINIAC_MAC)"
      for _ in 1 2 3 4 5 6; do sleep 5; reachable && { echo "  ✓ $HOST is up"; exit 0; }; done
      echo "  ! $HOST didn't answer yet — it auto-rejoins the tailnet once powered."
    else
      echo "  ($HOST is powered manually; set BRAINIAC_MAC + install wakeonlan for remote WOL.)"
      echo "  It auto-rejoins the tailnet on boot; then: ssh you@$HOST"
    fi
    ;;
  *) echo "usage: brainiac-ctl [status|up|wake]"; exit 1 ;;
esac
