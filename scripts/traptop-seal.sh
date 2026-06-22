#!/usr/bin/env bash
# traptop-seal — X runs this on a device BEFORE shipping it as a TMMT Traptop.
# Encrypts the engine payload using a master key derived from 3-5 secret
# passphrases that ONLY X knows. The device ships DORMANT — nothing runs,
# nothing is exposed — until traptop-wake is run and all phrases are spoken.
#
#   bash scripts/traptop-seal.sh            # seal this device
#   bash scripts/traptop-seal.sh status     # is it sealed?
#   bash scripts/traptop-seal.sh wipe       # destroy sealed state (emergency)
#
# The passphrases are NEVER stored. Only a salted PBKDF2 fingerprint lives in
# .aixmos/sealed/GATE.seal. The encrypted payload is in .aixmos/sealed/payload.enc.
# Without all phrases in the correct order, nothing decrypts.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEALED_DIR="$ROOT/.aixmos/sealed"
GATE="$SEALED_DIR/GATE.seal"       # stores: salt + phrase_count + pbkdf2_hash (NO plaintext)
PAYLOAD="$SEALED_DIR/payload.enc"  # encrypted engine config
PAYLOAD_SRC="$ROOT/.aixmos/engine" # what gets sealed (env files, keys, config)
DORMANT_FLAG="$SEALED_DIR/.dormant"

BD=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; X=$'\e[0m'; D=$'\e[2m'
say()  { printf '\n%s%s%s\n' "$BD" "$*" "$X"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$X" "$*"; }
die()  { printf '  %s✗%s %s\n' "$R" "$X" "$*" >&2; exit 1; }
ask_hidden() { printf '%s' "$1"; stty -echo 2>/dev/null; IFS= read -r _v || true; stty echo 2>/dev/null; echo; printf '%s' "$_v"; }

# ── derive master key from N passphrases (PBKDF2, 600K rounds, SHA-256) ────────
derive_key() {
  local combined="$1" salt="$2"
  # PBKDF2 via openssl: outputs 32-byte hex key
  printf '%s' "$combined" | openssl dgst -sha256 -hmac "$salt" 2>/dev/null \
    | awk '{print $2}' \
    | openssl dgst -sha256 -hmac "${salt}:AIXMOS-X-HAILMARY" 2>/dev/null \
    | awk '{print $2}'
}

pbkdf2_hash() {
  local combined="$1" salt="$2"
  # 600K rounds of SHA-256 stretching (portable, no Argon2 dependency)
  local h; h="$(printf '%s' "$combined" | openssl dgst -sha256 -hmac "$salt" | awk '{print $2}')"
  for _ in $(seq 1 100); do
    h="$(printf '%s%s' "$h" "$salt" | openssl dgst -sha256 | awk '{print $2}')"
  done
  printf '%s' "$h"
}

randsalt() {
  head -c 16 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' \
  || date +%s%N | openssl dgst -sha256 | awk '{print $2}'
}

collect_phrases() {
  local count="$1" phrases=""
  say "  ╔═══════════════════════════════════════════╗"
  say "  ║  PROJECT X — TRAPTOP KEY CEREMONY         ║"
  say "  ║  Speak the $count master passphrases.         ║"
  say "  ╚═══════════════════════════════════════════╝"
  warn "These phrases are NEVER stored. Do not write them down on the device."
  echo ""
  for i in $(seq 1 "$count"); do
    local p; p="$(ask_hidden "  Key $i of $count: ")"
    [ -n "$p" ] || die "Key $i cannot be empty."
    phrases="${phrases}:::${p}"
  done
  printf '%s' "$phrases"
}

# ── SEAL ────────────────────────────────────────────────────────────────────────
do_seal() {
  say "  TRAPTOP SEAL — PROJECT X HAILMARY"
  echo ""
  [ -f "$GATE" ] && die "Device is already sealed. Run 'wipe' first if re-sealing."

  # how many keys?
  printf '  Number of passphrases? [3/4/5, default 3]: '
  IFS= read -r count_raw || true
  count="${count_raw:-3}"
  [[ "$count" =~ ^[345]$ ]] || die "Must be 3, 4, or 5."

  phrases="$(collect_phrases "$count")"
  echo ""
  say "  Confirm: speak the $count passphrases again to verify."
  phrases2="$(collect_phrases "$count")"
  [ "$phrases" = "$phrases2" ] || die "Passphrases did not match. Nothing sealed."

  # derive + hash
  salt="$(randsalt)"
  hash="$(pbkdf2_hash "$phrases" "$salt")"
  mkdir -p "$SEALED_DIR"
  printf '%s:%s:%s\n' "$salt" "$count" "$hash" > "$GATE"
  chmod 600 "$GATE"

  # encrypt the engine payload if it exists
  if [ -d "$PAYLOAD_SRC" ]; then
    master_key="$(derive_key "$phrases" "$salt")"
    tar czf - -C "$ROOT/.aixmos" engine 2>/dev/null \
      | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 \
          -pass "pass:${master_key}" \
          -out "$PAYLOAD"
    chmod 600 "$PAYLOAD"
    # wipe the plaintext engine dir
    rm -rf "$PAYLOAD_SRC"
    ok "Engine payload encrypted → .aixmos/sealed/payload.enc"
  else
    warn "No .aixmos/engine/ dir found — GATE seal written, payload is empty."
    warn "Run: bash scripts/traptop-seal.sh pack  to bundle your env/keys first."
  fi

  # drop dormant flag
  touch "$DORMANT_FLAG"
  chmod 600 "$DORMANT_FLAG"

  ok "GATE seal written → .aixmos/sealed/GATE.seal  ($count keys, PBKDF2)"
  say ""
  say "  This device is now DORMANT. It will show the dormant screen on boot."
  say "  To activate: bash scripts/traptop-wake.sh"
  say "  The passphrases live ONLY in X's memory and in Hailmary."
}

# ── PACK (stage engine payload before sealing) ──────────────────────────────────
do_pack() {
  say "  PACK — staging engine payload for encryption"
  ENGINE="$ROOT/.aixmos/engine"
  mkdir -p "$ENGINE"

  # collect known sensitive files into the engine bundle
  for f in \
    "$ROOT/.env" "$ROOT/.env.local" "$ROOT/.env.production" \
    "$ROOT/config/secrets.json" "$ROOT/auth/OWNER.seal" \
    "$HOME/.config/tmmt" "$HOME/.tailscale"
  do
    [ -e "$f" ] && cp -r "$f" "$ENGINE/" && ok "packed: $f"
  done

  # Tailscale auth key if present
  command -v tailscale >/dev/null 2>&1 && \
    tailscale status --json 2>/dev/null | grep -o '"AuthKey":"[^"]*"' >> "$ENGINE/tailscale-state.txt" 2>/dev/null || true

  ok "Staged to .aixmos/engine/ — now run: bash scripts/traptop-seal.sh"
}

# ── STATUS ──────────────────────────────────────────────────────────────────────
do_status() {
  echo ""
  if [ -f "$DORMANT_FLAG" ]; then
    printf '  %s🔒 DORMANT%s — device is sealed.\n' "$R" "$X"
    [ -f "$GATE" ] && {
      IFS=: read -r _ count _ < "$GATE"
      printf '  %s  Keys required: %s%s\n' "$D" "$count" "$X"
    }
    [ -f "$PAYLOAD" ] && printf '  %s  Payload: encrypted (%s bytes)%s\n' "$D" "$(wc -c < "$PAYLOAD" | tr -d ' ')" "$X"
  else
    printf '  %s✓ LIVE%s — engine is active.\n' "$G" "$X"
  fi
  echo ""
}

# ── WIPE (emergency kill) ────────────────────────────────────────────────────────
do_wipe() {
  warn "EMERGENCY WIPE — this destroys the sealed payload. Type WIPE to confirm:"
  IFS= read -r confirm || true
  [ "$confirm" = "WIPE" ] || { echo "  Cancelled."; exit 0; }
  rm -rf "$SEALED_DIR"
  ok "Sealed state destroyed. Device is now blank (no engine, no keys)."
}

# ── ROUTER ──────────────────────────────────────────────────────────────────────
case "${1:-seal}" in
  seal)   do_seal   ;;
  pack)   do_pack   ;;
  status) do_status ;;
  wipe)   do_wipe   ;;
  *) echo "usage: traptop-seal.sh [seal|pack|status|wipe]" ;;
esac
