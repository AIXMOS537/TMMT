#!/usr/bin/env bash
# owner-seal — the lock on owner authority. Owner role is granted ONLY to someone
# who knows the Owner's passphrase. The passphrase itself is NEVER stored — only a
# salted SHA-256 fingerprint lives in the repo (auth/OWNER.seal). Operators cannot
# self-promote: they don't have the word, and the word comes only from the boss.
#
#   bash scripts/owner-seal.sh seal        (re)set the Owner passphrase
#   bash scripts/owner-seal.sh check        verify (prompts; exit 0 if correct)
#   bash scripts/owner-seal.sh status       is a seal set?
#
# The terms (charter): no one gets owner unless they speak with, are seen by, and
# have settled with the boss (Muhammad Taha). The word is the proof of that.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEAL="$ROOT/auth/OWNER.seal"
mkdir -p "$ROOT/auth"

sha256() { if command -v sha256sum >/dev/null 2>&1; then printf '%s' "$1" | sha256sum | awk '{print $1}';
           else printf '%s' "$1" | shasum -a 256 | awk '{print $1}'; fi; }
randsalt() { head -c 16 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || date +%s%N | sha256 ; }

# check <passphrase> -> 0 if it matches the seal
verify() {
  [ -f "$SEAL" ] || return 2
  local salt stored; IFS=: read -r salt stored < "$SEAL"
  [ "$(sha256 "${salt}:${1}")" = "$stored" ]
}

case "${1:-status}" in
  seal|set|reset)
    if [ -f "$SEAL" ]; then
      printf '  A seal already exists. Enter CURRENT owner passphrase to change it: '
      stty -echo 2>/dev/null; IFS= read -r cur || true; stty echo 2>/dev/null; echo
      verify "$cur" || { echo "  ✗ wrong passphrase — seal unchanged."; exit 1; }
    fi
    printf '  Set the NEW owner passphrase (hidden): '
    stty -echo 2>/dev/null; IFS= read -r p1 || true; stty echo 2>/dev/null; echo
    printf '  Confirm: '
    stty -echo 2>/dev/null; IFS= read -r p2 || true; stty echo 2>/dev/null; echo
    [ -n "$p1" ] && [ "$p1" = "$p2" ] || { echo "  ✗ empty or mismatch — nothing set."; exit 1; }
    salt="$(randsalt)"; printf '%s:%s\n' "$salt" "$(sha256 "${salt}:${p1}")" > "$SEAL"
    echo "  ✓ Owner seal set. Commit auth/OWNER.seal so it travels (the secret is NOT in it)."
    ;;
  check|verify)
    [ -f "$SEAL" ] || { echo "  ! no seal set yet — run: bash scripts/owner-seal.sh seal"; exit 2; }
    printf '  Owner passphrase: '
    stty -echo 2>/dev/null; IFS= read -r p || true; stty echo 2>/dev/null; echo
    if verify "$p"; then echo "  ✓ correct — owner authority granted."; exit 0;
    else echo "  ✗ incorrect."; exit 1; fi
    ;;
  status)
    [ -f "$SEAL" ] && echo "  seal: SET (auth/OWNER.seal)" || echo "  seal: not set — run: bash scripts/owner-seal.sh seal"
    ;;
  *) echo "owner-seal words: seal | check | status";;
esac
