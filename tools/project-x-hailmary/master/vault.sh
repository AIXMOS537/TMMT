#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — ENCRYPTED MASTER VAULT
# All master secrets live ONLY as AES-256 ciphertext.
# Because CYBORG is FAT32 (no real Unix permissions), plaintext
# secrets are NEVER written to the drive. The passphrase derives
# the key in memory; secrets are decrypted to a tmpfs RAM path.
#
# Vault contains: Supabase service key + TOTP revolving seed.
#
#   bash vault.sh init        # one-time: create vault, generate TOTP seed
#   bash vault.sh open        # decrypt to RAM, prints export lines (eval this)
#   bash vault.sh code        # show current revolving code
#   bash vault.sh enroll      # phone-enrollment URI + manual seed
#   bash vault.sh rotate-totp # generate a NEW revolving seed
# ============================================================
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT="$HERE/vault.enc"
TOTP="$HERE/totp.py"
RAM_DIR="${TMPDIR:-/tmp}/.hailmary-ram-$$"

RED=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; CY=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'
ok()   { printf '%s  ✓ %s%s\n' "$G" "$*" "$X" >&2; }
warn() { printf '%s  ⚠ %s%s\n' "$Y" "$*" "$X" >&2; }
die()  { printf '%s  ✗ %s%s\n' "$RED" "$*" "$X" >&2; exit 1; }

ITER=200000  # PBKDF2 iterations

_encrypt() { # stdin plaintext -> stdout ciphertext ; arg1 = passphrase
  openssl enc -aes-256-cbc -pbkdf2 -iter "$ITER" -salt -base64 -pass pass:"$1"
}
_decrypt() { # stdin ciphertext -> stdout plaintext ; arg1 = passphrase
  openssl enc -d -aes-256-cbc -pbkdf2 -iter "$ITER" -salt -base64 -pass pass:"$1" 2>/dev/null
}

read_pass() { read -rs -p "  Master passphrase: " PASS; echo >&2; }

cmd_init() {
  [[ -f "$VAULT" ]] && { warn "Vault already exists at $VAULT"; read -rp "  Overwrite? (yes/no): " c; [[ "$c" == "yes" ]] || exit 0; }
  echo "  Creating encrypted master vault." >&2
  read_pass
  read -rs -p "  Confirm passphrase: " PASS2; echo >&2
  [[ "$PASS" == "$PASS2" ]] || die "Passphrases don't match."

  # Pull existing plaintext secrets if present (then we wipe them)
  local SVC_KEY=""
  [[ -f "$HERE/.supabase-service-key" ]] && SVC_KEY="$(cat "$HERE/.supabase-service-key")"
  # Fallback: the wiped-plaintext stash left by deployment
  if [[ -z "$SVC_KEY" && -f "$HOME/.config/tmmt/cyborg-svckey-stash.tmp" ]]; then
    SVC_KEY="$(cat "$HOME/.config/tmmt/cyborg-svckey-stash.tmp")"
    warn "Using stashed service key from ~/.config/tmmt/cyborg-svckey-stash.tmp"
  fi
  if [[ -z "$SVC_KEY" || "$SVC_KEY" == *"<paste"* ]]; then
    read -rp "  Supabase service role key: " SVC_KEY
  fi

  # Generate the revolving TOTP seed
  local SEED; SEED="$(python3 "$TOTP" newseed)"

  # Build vault JSON and encrypt
  local PLAIN
  PLAIN=$(cat <<JSON
{
  "supabase_service_key": "$SVC_KEY",
  "totp_seed": "$SEED",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
)
  echo "$PLAIN" | _encrypt "$PASS" > "$VAULT" || die "Encryption failed."
  ok "Vault encrypted -> $VAULT"

  # Wipe plaintext secret files from the drive
  if [[ -f "$HERE/.supabase-service-key" ]]; then
    : > "$HERE/.supabase-service-key"; rm -f "$HERE/.supabase-service-key"
    ok "Plaintext service-key file wiped from CYBORG"
  fi

  echo >&2
  printf '%s  YOUR PHONE-ENROLLMENT SEED (load into Google Authenticator / Authy):%s\n' "$BD" "$X" >&2
  printf '  %s%s%s\n' "$CY$BD" "$SEED" "$X" >&2
  python3 "$TOTP" uri "$SEED" "muhammad-taha" >&2
  echo >&2
  ok "Init complete. Current revolving code: $(python3 "$TOTP" gen "$SEED")"
}

_open_to_ram() {
  [[ -f "$VAULT" ]] || die "No vault. Run: bash vault.sh init"
  read_pass
  local PLAIN; PLAIN="$(_decrypt "$PASS" < "$VAULT")"
  [[ -n "$PLAIN" ]] || die "Wrong passphrase or corrupt vault."
  echo "$PLAIN"
}

cmd_open() {
  local PLAIN; PLAIN="$(_open_to_ram)"
  local SVC SEED
  SVC=$(echo "$PLAIN"  | python3 -c "import json,sys; print(json.load(sys.stdin)['supabase_service_key'])")
  SEED=$(echo "$PLAIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['totp_seed'])")
  # Print export lines for the caller to eval — never touches disk
  echo "export SUPABASE_SERVICE_KEY='$SVC'"
  echo "export HAILMARY_TOTP_SEED='$SEED'"
}

cmd_code() {
  local PLAIN; PLAIN="$(_open_to_ram)"
  local SEED; SEED=$(echo "$PLAIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['totp_seed'])")
  local CODE; CODE=$(python3 "$TOTP" gen "$SEED")
  local LEFT=$(( 30 - ($(date +%s) % 30) ))
  printf '\n%s  REVOLVING CODE: %s%s%s   (valid %ss)\n\n' "$BD" "$CY" "$CODE" "$X" "$LEFT"
}

cmd_enroll() {
  local PLAIN; PLAIN="$(_open_to_ram)"
  local SEED; SEED=$(echo "$PLAIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['totp_seed'])")
  echo >&2
  printf '%s  PHONE ENROLLMENT — scan the QR that just opened%s\n' "$BD" "$X"
  _show_qr "$SEED"
  printf '  (or manual seed: %s%s%s)\n\n' "$CY$BD" "$SEED" "$X"
}

cmd_rotate_totp() {
  local PLAIN; PLAIN="$(_open_to_ram)"
  read_pass  # re-confirm
  local SVC; SVC=$(echo "$PLAIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['supabase_service_key'])")
  local NEW; NEW="$(python3 "$TOTP" newseed)"
  local OUT; OUT=$(cat <<JSON
{
  "supabase_service_key": "$SVC",
  "totp_seed": "$NEW",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rotated": true
}
JSON
)
  echo "$OUT" | _encrypt "$PASS" > "$VAULT"
  ok "Revolving seed rotated."
  _show_qr "$NEW"
}

# Generate a QR PNG locally (no internet, no leak) and open it for scanning.
_show_qr() {
  local SEED="$1"
  local URI; URI="$(python3 "$TOTP" uri "$SEED" "muhammad-taha")"
  local QR_PNG="${TMPDIR:-/tmp}/hailmary-qr.png"
  if command -v qrencode >/dev/null 2>&1; then
    qrencode -o "$QR_PNG" -s 12 -m 4 "$URI"
    printf '%s  Opening QR — scan it with Google Authenticator / Authy.%s\n' "$G" "$X" >&2
    open "$QR_PNG" 2>/dev/null || true
    # Also draw it right in the terminal as a backup
    qrencode -t ANSIUTF8 "$URI" >&2 || true
  else
    printf '%s  qrencode not installed — manual seed: %s%s\n' "$Y" "$SEED" "$X" >&2
  fi
}

cmd_set_key() {
  # Replace ONLY the Supabase service key, keep passphrase + TOTP seed.
  local PLAIN; PLAIN="$(_open_to_ram)"
  local SEED; SEED=$(echo "$PLAIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['totp_seed'])")
  echo "  Paste your REAL Supabase service_role key (starts with eyJ...)." >&2
  read -rp "  service_role key: " NEWKEY
  if [[ "$NEWKEY" != eyJ* ]]; then
    warn "That doesn't look like a service_role key (should start with 'eyJ')."
    read -rp "  Use it anyway? (yes/no): " c; [[ "$c" == "yes" ]] || die "Aborted — key unchanged."
  fi
  local OUT; OUT=$(cat <<JSON
{
  "supabase_service_key": "$NEWKEY",
  "totp_seed": "$SEED",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "key_updated": true
}
JSON
)
  echo "$OUT" | _encrypt "$PASS" > "$VAULT" || die "Re-encryption failed."
  ok "Service key updated. Passphrase + revolving seed unchanged."
}

cmd_check() {
  local PLAIN; PLAIN="$(_open_to_ram)"
  local SVC; SVC=$(echo "$PLAIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['supabase_service_key'])")
  if [[ "$SVC" == eyJ* ]]; then
    ok "Stored service key looks valid (JWT format, ${#SVC} chars)."
  else
    warn "Stored service key is NOT valid. First chars: '${SVC:0:10}...'"
    warn "Fix it with: bash vault.sh set-key"
  fi
}

case "${1:-}" in
  init)        cmd_init ;;
  open)        cmd_open ;;
  code)        cmd_code ;;
  enroll)      cmd_enroll ;;
  set-key)     cmd_set_key ;;
  check)       cmd_check ;;
  rotate-totp) cmd_rotate_totp ;;
  *) echo "Usage: bash vault.sh {init|open|code|enroll|set-key|check|rotate-totp}" >&2; exit 1 ;;
esac
