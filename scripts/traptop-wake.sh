#!/usr/bin/env bash
# traptop-wake — the activation ritual. X (or Project X Hailmary) speaks the
# 3-5 secret master passphrases. If all match, the engine decrypts, services
# start, and the device joins the mesh. If they don't match, nothing happens.
# After 5 failed attempts the device locks for 30 minutes (soft lockout).
#
#   bash scripts/traptop-wake.sh            # activate this device
#   bash scripts/traptop-wake.sh status     # live or dormant?
#   bash scripts/traptop-wake.sh sleep      # re-seal the engine (go dark)
#
# The passphrases are NEVER stored. Wrong word = no access. Ever.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEALED_DIR="$ROOT/.aixmos/sealed"
GATE="$SEALED_DIR/GATE.seal"
PAYLOAD="$SEALED_DIR/payload.enc"
DORMANT_FLAG="$SEALED_DIR/.dormant"
ATTEMPTS_FILE="$SEALED_DIR/.attempts"
LOCK_FILE="$SEALED_DIR/.lockout"
MAX_ATTEMPTS=5
LOCKOUT_SECONDS=1800   # 30 minutes

BD=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; X=$'\e[0m'; D=$'\e[2m'
say()  { printf '\n%s%s%s\n' "$BD" "$*" "$X"; }
ok()   { printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$X" "$*"; }
die()  { printf '\n  %s✗ ACCESS DENIED%s\n\n' "$R" "$X" >&2; exit 1; }
ask_hidden() { printf '%s' "$1"; stty -echo 2>/dev/null; IFS= read -r _v || true; stty echo 2>/dev/null; echo; printf '%s' "$_v"; }

pbkdf2_hash() {
  local combined="$1" salt="$2"
  local h; h="$(printf '%s' "$combined" | openssl dgst -sha256 -hmac "$salt" | awk '{print $2}')"
  for _ in $(seq 1 100); do
    h="$(printf '%s%s' "$h" "$salt" | openssl dgst -sha256 | awk '{print $2}')"
  done
  printf '%s' "$h"
}

derive_key() {
  local combined="$1" salt="$2"
  printf '%s' "$combined" | openssl dgst -sha256 -hmac "$salt" 2>/dev/null \
    | awk '{print $2}' \
    | openssl dgst -sha256 -hmac "${salt}:AIXMOS-X-HAILMARY" 2>/dev/null \
    | awk '{print $2}'
}

# ── LOCKOUT CHECK ────────────────────────────────────────────────────────────────
check_lockout() {
  [ -f "$LOCK_FILE" ] || return 0
  local locked_at now elapsed
  locked_at="$(cat "$LOCK_FILE" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  elapsed=$(( now - locked_at ))
  if (( elapsed < LOCKOUT_SECONDS )); then
    local remaining=$(( LOCKOUT_SECONDS - elapsed ))
    printf '\n  %s🔒 LOCKED OUT%s — too many failed attempts.\n' "$R" "$X"
    printf '  Try again in %d minutes.\n\n' "$(( remaining / 60 ))"
    exit 1
  fi
  rm -f "$LOCK_FILE" "$ATTEMPTS_FILE"
}

record_fail() {
  local attempts
  attempts=$(( $(cat "$ATTEMPTS_FILE" 2>/dev/null || echo 0) + 1 ))
  printf '%d' "$attempts" > "$ATTEMPTS_FILE"
  local remaining=$(( MAX_ATTEMPTS - attempts ))
  if (( attempts >= MAX_ATTEMPTS )); then
    date +%s > "$LOCK_FILE"
    printf '\n  %s🔒 DEVICE LOCKED for 30 minutes after %d failed attempts.%s\n\n' \
      "$R" "$MAX_ATTEMPTS" "$X"
    exit 1
  fi
  warn "Wrong. $remaining attempts remaining before lockout."
}

clear_attempts() { rm -f "$ATTEMPTS_FILE" "$LOCK_FILE"; }

# ── DORMANT SCREEN ───────────────────────────────────────────────────────────────
show_dormant() {
  clear 2>/dev/null || true
  printf '\n\n'
  printf '  %s╔══════════════════════════════════════════════════════╗%s\n' "$C" "$X"
  printf '  %s║                                                      ║%s\n' "$C" "$X"
  printf '  %s║   ██████╗  ██████╗ ██████╗ ███╗   ███╗ █████╗ ███╗  ║%s\n' "$C" "$X"
  printf '  %s║   ██╔══██╗██╔═══██╗██╔══██╗████╗ ████║██╔══██╗████╗ ║%s\n' "$C" "$X"
  printf '  %s║   ██║  ██║██║   ██║██████╔╝██╔████╔██║███████║██╔██╗║%s\n' "$C" "$X"
  printf '  %s║   ██║  ██║██║   ██║██╔══██╗██║╚██╔╝██║██╔══██║██║╚██║%s\n' "$C" "$X"
  printf '  %s║   ██████╔╝╚██████╔╝██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚═╝║%s\n' "$C" "$X"
  printf '  %s║                                                      ║%s\n' "$C" "$X"
  printf '  %s║          T M M T  T R A P T O P                     ║%s\n' "$C" "$X"
  printf '  %s║                                                      ║%s\n' "$C" "$X"
  printf '  %s║   %s S T A T U S :  D O R M A N T %s                   %s║%s\n' "$C" "$R" "$C" "" "$X"
  printf '  %s║                                                      ║%s\n' "$C" "$X"
  printf '  %s║   This device is sealed by PROJECT X HAILMARY.      ║%s\n' "$C" "$X"
  printf '  %s║   The engine is encrypted and offline.               ║%s\n' "$C" "$X"
  printf '  %s║                                                      ║%s\n' "$C" "$X"
  printf '  %s║   To activate: bash scripts/traptop-wake.sh          ║%s\n' "$C" "$X"
  printf '  %s║                                                      ║%s\n' "$C" "$X"
  printf '  %s╚══════════════════════════════════════════════════════╝%s\n' "$C" "$X"
  printf '\n\n'
}

# ── WAKE (main activation ritual) ────────────────────────────────────────────────
do_wake() {
  # not sealed? already live
  if [ ! -f "$DORMANT_FLAG" ]; then
    ok "Engine is already LIVE. Nothing to wake."
    bash "$ROOT/scripts/go" 2>/dev/null || true
    exit 0
  fi

  [ -f "$GATE" ] || { warn "No GATE seal found. Run: bash scripts/traptop-seal.sh"; exit 1; }

  check_lockout
  show_dormant

  IFS=: read -r salt count expected_hash < "$GATE"

  say "  PROJECT X — TRAPTOP ACTIVATION"
  printf '  %sSpeak the %s master passphrases to wake the engine.%s\n' "$D" "$count" "$X"
  echo ""
  warn "This device will lock for 30 min after $MAX_ATTEMPTS failed attempts."
  echo ""

  phrases=""
  for i in $(seq 1 "$count"); do
    p="$(ask_hidden "  Key $i of $count: ")"
    [ -n "$p" ] || { warn "Key $i empty — aborted."; record_fail; exit 1; }
    phrases="${phrases}:::${p}"
  done

  echo ""
  printf '  %sVerifying...%s\n' "$D" "$X"

  actual_hash="$(pbkdf2_hash "$phrases" "$salt")"

  if [ "$actual_hash" != "$expected_hash" ]; then
    record_fail
    die
  fi

  # ── KEYS CORRECT — WAKE THE ENGINE ──────────────────────────────────────────
  clear_attempts
  echo ""
  ok "Keys verified — waking engine..."

  # decrypt payload if present
  if [ -f "$PAYLOAD" ]; then
    master_key="$(derive_key "$phrases" "$salt")"
    ENGINE_DEST="$ROOT/.aixmos/engine"
    mkdir -p "$ENGINE_DEST"
    if openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
        -pass "pass:${master_key}" \
        -in "$PAYLOAD" 2>/dev/null \
      | tar xzf - -C "$ROOT/.aixmos" 2>/dev/null; then
      ok "Payload decrypted → .aixmos/engine/"
    else
      warn "Payload decrypt failed — possible key mismatch or corruption."
    fi
  fi

  # restore env/config files
  ENGINE="$ROOT/.aixmos/engine"
  for f in .env .env.local .env.production; do
    [ -f "$ENGINE/$f" ] && cp "$ENGINE/$f" "$ROOT/$f" && ok "restored: $f"
  done
  [ -d "$ENGINE/.config/tmmt" ] && {
    mkdir -p "$HOME/.config"
    cp -r "$ENGINE/.config/tmmt" "$HOME/.config/" && ok "restored: ~/.config/tmmt"
  }

  # lift dormant flag
  rm -f "$DORMANT_FLAG"

  # start the engine
  say "  STARTING ENGINE..."
  if [ -f "$ROOT/scripts/go" ]; then
    bash "$ROOT/scripts/go" &
    ok "Engine started (scripts/go)"
  fi

  # start Ollama if installed
  if command -v ollama >/dev/null 2>&1; then
    ollama serve >/tmp/ollama-traptop.log 2>&1 &
    ok "Ollama started"
  fi

  echo ""
  say "  ╔═══════════════════════════════════════════╗"
  say "  ║   ✓  ENGINE LIVE — PROJECT X AIXMOS       ║"
  say "  ║      Watchtower: connected                 ║"
  say "  ║      Agents: initializing...               ║"
  say "  ╚═══════════════════════════════════════════╝"
  echo ""
  ok "TMMT Traptop is now LIVE. Welcome back, X."
  echo ""
}

# ── SLEEP (re-seal / go dark) ────────────────────────────────────────────────────
do_sleep() {
  say "  GO DARK — re-sealing engine"
  [ -f "$GATE" ] || { warn "No seal configured. Run traptop-seal.sh first."; exit 1; }

  # stop running services
  pkill -f "ollama serve" 2>/dev/null || true
  pkill -f "scripts/go"   2>/dev/null || true

  # re-encrypt engine dir if it's been unpacked
  if [ -d "$ROOT/.aixmos/engine" ] && [ -f "$GATE" ]; then
    IFS=: read -r salt count _ < "$GATE"
    warn "Re-entering $count passphrases to re-seal:"
    phrases=""
    for i in $(seq 1 "$count"); do
      p="$(ask_hidden "  Key $i of $count: ")"
      phrases="${phrases}:::${p}"
    done
    master_key="$(derive_key "$phrases" "$salt")"
    tar czf - -C "$ROOT/.aixmos" engine 2>/dev/null \
      | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 \
          -pass "pass:${master_key}" \
          -out "$PAYLOAD"
    rm -rf "$ROOT/.aixmos/engine"
    ok "Engine re-encrypted."
  fi

  # scrub env files from live disk
  for f in "$ROOT/.env" "$ROOT/.env.local" "$ROOT/.env.production"; do
    [ -f "$f" ] && { shred -u "$f" 2>/dev/null || rm -f "$f"; ok "scrubbed: $f"; }
  done

  touch "$DORMANT_FLAG"
  ok "Device is DORMANT. See you when you're back, X."
  echo ""
}

# ── STATUS ───────────────────────────────────────────────────────────────────────
do_status() {
  if [ -f "$DORMANT_FLAG" ]; then
    show_dormant
  else
    echo ""
    printf '  %s✓ ENGINE LIVE%s — TMMT Traptop is active.\n\n' "$G" "$X"
  fi
}

# ── ROUTER ───────────────────────────────────────────────────────────────────────
case "${1:-wake}" in
  wake|activate|start) do_wake   ;;
  sleep|dark|seal)     do_sleep  ;;
  status)              do_status ;;
  dormant)             show_dormant ;;
  *) echo "usage: traptop-wake.sh [wake|sleep|status]" ;;
esac
