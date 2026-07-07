#!/usr/bin/env bash
# detect-device.sh — auto-detect BLIP role + tier from hostname/OS.
# Outputs: BLIP_ROLE=carry|forge|brain|ops|rick  BLIP_TIER=sovereign|employee
set -euo pipefail

OS="unknown"
case "$(uname -s 2>/dev/null)" in
  Darwin) OS="mac" ;;
  Linux)  OS="linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
esac

HOST="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
BLIP_ROLE="${BLIP_ROLE:-}"
BLIP_TIER="employee"

# Taha-owned → sovereign tier
case "$HOST" in
  macbook-pro-*|macbook*|carry*|watchtower*)
    BLIP_ROLE="${BLIP_ROLE:-carry}"
    BLIP_TIER="sovereign"
    ;;
  *rick*|*m1*|m1*|tmmt*)
    BLIP_ROLE="${BLIP_ROLE:-rick}"
    BLIP_TIER="sovereign"
    ;;
  brainiac*)
    BLIP_ROLE="${BLIP_ROLE:-brain}"
    BLIP_TIER="sovereign"
    ;;
  desktop-*|office-*|pc-*|win-*)
    BLIP_ROLE="${BLIP_ROLE:-forge}"
    BLIP_TIER="employee"
    ;;
  *)
    if [[ "$OS" == "windows" ]]; then
      BLIP_ROLE="${BLIP_ROLE:-forge}"
      BLIP_TIER="employee"
    elif [[ "$OS" == "mac" ]]; then
      BLIP_ROLE="${BLIP_ROLE:-forge}"
      BLIP_TIER="employee"
    else
      BLIP_ROLE="${BLIP_ROLE:-ops}"
      BLIP_TIER="employee"
    fi
    ;;
esac

export BLIP_ROLE BLIP_TIER BLIP_OS="$OS" BLIP_HOST="$HOST"
printf 'BLIP_ROLE=%s\nBLIP_TIER=%s\nBLIP_OS=%s\nBLIP_HOST=%s\n' "$BLIP_ROLE" "$BLIP_TIER" "$OS" "$HOST"
