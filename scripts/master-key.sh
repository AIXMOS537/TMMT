#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# master-key.sh — the owner's two-factor master key.
#   • A MASTER PHRASE that only the human (Muhammad Taha) knows — NEVER stored.
#     The system keeps only a one-way hash + a blob encrypted UNDER the phrase.
#   • A ROTATING TOTP code from your authenticator app (changes every 30s).
#   UNLOCK requires BOTH. Lose the file? Useless without the phrase in your head.
#
#   master-key.sh seal      set the master phrase + bind your authenticator (once)
#   master-key.sh unlock    enter phrase + current 6-digit code -> UNLOCKED
#   master-key.sh status    is it sealed? (reveals nothing)
#   master-key.sh reset     wipe the seal (requires a successful unlock first)
#
# Needs: openssl + python3 (both built into macOS). Store: .aixmos/seal (gitignored).
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
G(){ printf "\033[32m%s\033[0m\n" "$1"; }
R(){ printf "\033[31m%s\033[0m\n" "$1"; }
die(){ R "✗ $1"; exit 1; }
command -v openssl >/dev/null || die "openssl required (built into macOS)"
command -v python3 >/dev/null || die "python3 required (built into macOS)"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DIR="$ROOT/.aixmos/seal"; SEAL="$DIR/master.seal"; TOKEN="$DIR/UNLOCKED"
mkdir -p "$DIR"; chmod 700 "$DIR" 2>/dev/null || true

# --- TOTP code from a base32 secret (RFC 6238), prints current code ---
totp_now() { python3 - "$1" "${2:-0}" <<'PY'
import hmac,hashlib,base64,struct,time,sys
sec=sys.argv[1].strip().replace(" ","").upper(); off=int(sys.argv[2])
sec+="="*((8-len(sec)%8)%8)
key=base64.b32decode(sec)
ctr=int(time.time())//30 + off
h=hmac.new(key,struct.pack('>Q',ctr),hashlib.sha1).digest()
o=h[19]&15; code=(struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%1000000
print("%06d"%code)
PY
}
rand_b32(){ python3 - <<'PY'
import os,base64; print(base64.b32encode(os.urandom(20)).decode().rstrip("="))
PY
}
sha(){ printf '%s' "$1" | openssl dgst -sha256 | sed 's/^.*= //'; }

read_hidden(){ local p="$1" v=""; printf '%s' "$p" >&2; read -rs v; printf '\n' >&2; printf '%s' "$v"; }

case "${1:-status}" in
  seal)
    [ -f "$SEAL" ] && die "Already sealed. Run 'unlock' then 'reset' to change it."
    B "== Seal the master key =="
    P1="$(read_hidden 'Master phrase (only YOU will ever know it): ')"
    [ ${#P1} -ge 8 ] || die "Use at least 8 characters."
    P2="$(read_hidden 'Type it again to confirm: ')"
    [ "$P1" = "$P2" ] || die "Phrases did not match."
    echo
    B "Authenticator (the always-rotating code):"
    echo "  1) generate a NEW secret to add to your app (recommended)"
    echo "  2) use an EXISTING base32 secret you already have"
    printf "Choose 1 or 2: "; read -r CH
    if [ "$CH" = "2" ]; then SECRET="$(read_hidden 'Paste your base32 TOTP secret: ' | tr -d ' ' )"
    else SECRET="$(rand_b32)"; fi
    [ -n "$SECRET" ] || die "No secret."
    SALT="$(openssl rand -hex 16)"
    PHASH="$(sha "$SALT:$P1")"
    # encrypt the TOTP secret UNDER the phrase (file is useless without the phrase)
    ENC="$(printf '%s' "$SECRET" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "pass:$P1" -base64 -A)"
    umask 077
    printf 'v1\nsalt=%s\nphash=%s\nenc=%s\n' "$SALT" "$PHASH" "$ENC" > "$SEAL"
    chmod 600 "$SEAL"
    G "✓ Sealed. The phrase is NOT stored — only its hash + a blob locked under it."
    if [ "$CH" != "2" ]; then
      echo
      B "Add this to your authenticator app NOW (scan or type the key):"
      echo "  key:  $SECRET"
      echo "  uri:  otpauth://totp/AIXMOS:owner?secret=$SECRET&issuer=AIXMOS&period=30&digits=6"
      echo "  (then run: master-key.sh unlock  to confirm it works)"
    fi
    ;;

  unlock)
    [ -f "$SEAL" ] || die "Not sealed yet. Run: master-key.sh seal"
    SALT="$(grep '^salt=' "$SEAL" | cut -d= -f2-)"
    PHASH="$(grep '^phash=' "$SEAL" | cut -d= -f2-)"
    ENC="$(grep '^enc=' "$SEAL" | cut -d= -f2-)"
    P="$(read_hidden 'Master phrase: ')"
    [ "$(sha "$SALT:$P")" = "$PHASH" ] || { R "✗ DENIED — wrong phrase."; exit 1; }
    SECRET="$(printf '%s' "$ENC" | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "pass:$P" -base64 -A 2>/dev/null)" || { R "✗ DENIED."; exit 1; }
    CODE="$(read_hidden 'Current 6-digit code from your app: ' | tr -d ' ')"
    ok=0
    for off in 0 -1 1; do [ "$CODE" = "$(totp_now "$SECRET" "$off")" ] && ok=1 && break; done
    [ "$ok" = 1 ] || { R "✗ DENIED — code wrong or expired."; exit 1; }
    # short-lived unlock token (5 min)
    printf 'unlocked_at=%s\nexpires=%s\n' "$(date +%s)" "$(( $(date +%s) + 300 ))" > "$TOKEN"; chmod 600 "$TOKEN"
    G "✅ UNLOCKED — phrase + rotating code both verified. (valid 5 min)"
    ;;

  status)
    if [ -f "$SEAL" ]; then G "🔒 Sealed (master key is set). Phrase is NOT stored."
      if [ -f "$TOKEN" ] && [ "$(date +%s)" -lt "$(grep expires "$TOKEN"|cut -d= -f2)" ] 2>/dev/null; then echo "   status: UNLOCKED (token active)"; else echo "   status: locked"; fi
    else echo "Not sealed. Run: master-key.sh seal"; fi
    ;;

  reset)
    [ -f "$TOKEN" ] && [ "$(date +%s)" -lt "$(grep expires "$TOKEN"|cut -d= -f2 2>/dev/null)" ] 2>/dev/null \
      || die "Unlock first (master-key.sh unlock), then reset within 5 min."
    rm -f "$SEAL" "$TOKEN"; G "✓ Seal wiped. Run 'seal' to set a new master key."
    ;;

  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) echo "usage: master-key.sh {seal|unlock|status|reset}";;
esac
