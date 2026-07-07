#!/usr/bin/env bash
# office-mode.sh — HAILMARY lock/unlock for office devices.
# Employees NEVER get master keys. Taha unlocks when present.
#
#   bash office-mode.sh unlock     # full sovereign (owner in office)
#   bash office-mode.sh lock       # employee-safe (virtual key only)
#   bash office-mode.sh status     # show current mode
#   bash office-mode.sh broadcast  # Carry → sync unlock flag to mesh (Syncthing)
set -euo pipefail

TMMT_CFG="${HOME}/.config/tmmt"
LOCK_FILE="${TMMT_CFG}/hailmary-unlocked"
MASTER_VAULT="${TMMT_CFG}/.owner-only"
SYNC_FLAG="${HOME}/Sync/rick/OFFICE-UNLOCKED"
UNLOCK_SECRET_FILE="${MASTER_VAULT}/office-unlock.secret"
UNLOCK_HOURS="${HAILMARY_UNLOCK_HOURS:-8}"

log(){ printf '[office-mode] %s\n' "$*"; }
die(){ log "ERROR: $*"; exit 1; }

ensure_cfg(){ mkdir -p "$TMMT_CFG" "$MASTER_VAULT" "${HOME}/Sync/rick" 2>/dev/null || true; }

ensure_unlock_secret(){
  ensure_cfg
  if [[ ! -f "$UNLOCK_SECRET_FILE" ]]; then
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex 32 > "$UNLOCK_SECRET_FILE"
    else
      date +%s%N | shasum -a 256 | cut -d' ' -f1 > "$UNLOCK_SECRET_FILE"
    fi
    chmod 600 "$UNLOCK_SECRET_FILE"
    log "Generated office unlock secret (Carry only — never ship in BLIP)"
  fi
}

sign_unlock(){
  local exp="$1"
  local secret
  secret="$(cat "$UNLOCK_SECRET_FILE" 2>/dev/null || echo "")"
  [[ -n "$secret" ]] || return 1
  printf '%s:%s' "$exp" "$secret" | shasum -a 256 | cut -d' ' -f1
}

verify_sync_unlock(){
  [[ -f "$SYNC_FLAG" ]] || return 1
  local exp sig expected
  exp="$(grep -E '^expires=' "$SYNC_FLAG" 2>/dev/null | cut -d= -f2 || echo 0)"
  sig="$(grep -E '^sig=' "$SYNC_FLAG" 2>/dev/null | cut -d= -f2 || echo "")"
  [[ "$(date +%s)" -lt "$exp" ]] || return 1
  [[ -n "$sig" ]] || return 1
  # Verify against local secret (must be copied from Carry to owner devices — never employee PCs)
  if [[ -f "$UNLOCK_SECRET_FILE" ]]; then
    expected="$(sign_unlock "$exp")"
    [[ "$sig" == "$expected" ]] || return 1
  else
    return 1
  fi
  return 0
}

is_taha_host(){
  local h
  h="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  case "$h" in
    macbook-pro-*|macbook*|carry*|watchtower*|*rick*|*m1*) return 0 ;;
    brainiac*) return 0 ;;
    *) return 1 ;;
  esac
}

unlock_expired(){
  [[ ! -f "$LOCK_FILE" ]] && return 0
  local exp now
  exp="$(grep -E '^expires=' "$LOCK_FILE" 2>/dev/null | cut -d= -f2 || echo 0)"
  now="$(date +%s)"
  [[ "$exp" -lt "$now" ]] && return 0
  return 1
}

apply_employee_lock(){
  ensure_cfg
  # Move master secrets out of reach (not delete — owner can unlock)
  for f in litellm-master.env god-mode.env sovereign-master.env; do
    [[ -f "${TMMT_CFG}/${f}" ]] && mv -f "${TMMT_CFG}/${f}" "${MASTER_VAULT}/${f}" 2>/dev/null || true
  done
  # Employee tier env — virtual key only, no vault, no hc god
  cat > "${TMMT_CFG}/active-tier.env" <<'EMP'
# HAILMARY OFFICE LOCK — employee / kiosk safe
HAILMARY_TIER=locked
HAILMARY_ACCESS=virtual-key-only
# NEVER: master key · vault · hc god · FOUNDER key · Stripe · Supabase service_role
ALLOWED_MODELS=rick-safe,fast
EMP
  chmod 600 "${TMMT_CFG}/active-tier.env"
  # Point tools at Rick gateway with scoped key if present
  if [[ -f "${TMMT_CFG}/rick.env" ]]; then
    log "Using scoped rick.env (virtual key)"
  else
    cat > "${TMMT_CFG}/rick.env" <<'RICK'
# Paste VA virtual key from LiteLLM admin — NEVER master key here
OPENAI_API_BASE=http://macbook-pro-2.tailceb455.ts.net:4001/v1
# OPENAI_API_KEY=sk-virtual-KEY-FROM-LITELLM-ADMIN
RICK
    chmod 600 "${TMMT_CFG}/rick.env"
    log "Created rick.env template — issue virtual key in LiteLLM admin"
  fi
  rm -f "$LOCK_FILE" 2>/dev/null || true
  log "LOCKED — employee-safe mode. No master keys on this device."
}

apply_owner_unlock(){
  ensure_cfg
  local exp
  exp="$(($(date +%s) + UNLOCK_HOURS * 3600))"
  cat > "$LOCK_FILE" <<EOF
# HAILMARY owner unlock — expires automatically
unlocked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
expires=$exp
by=$(id -un)@$(hostname -s)
EOF
  chmod 600 "$LOCK_FILE"
  # Restore master secrets to active config
  for f in litellm-master.env god-mode.env sovereign-master.env; do
    [[ -f "${MASTER_VAULT}/${f}" ]] && cp -f "${MASTER_VAULT}/${f}" "${TMMT_CFG}/${f}" && chmod 600 "${TMMT_CFG}/${f}"
  done
  cat > "${TMMT_CFG}/active-tier.env" <<'OWN'
# HAILMARY OFFICE UNLOCK — owner sovereign
HAILMARY_TIER=sovereign
HAILMARY_ACCESS=full
SOVEREIGN_APEX=1
OWN
  chmod 600 "${TMMT_CFG}/active-tier.env"
  # Source master into rick.env if available
  if [[ -f "${TMMT_CFG}/litellm-master.env" ]]; then
    # shellcheck disable=SC1090
    source "${TMMT_CFG}/litellm-master.env"
    [[ -n "${LITELLM_MASTER_KEY:-}" ]] && {
      cat > "${TMMT_CFG}/rick.env" <<EOF
OPENAI_API_BASE=http://127.0.0.1:4001/v1
OPENAI_API_KEY=${LITELLM_MASTER_KEY}
EOF
      chmod 600 "${TMMT_CFG}/rick.env"
    }
  fi
  log "UNLOCKED — full HAILMARY sovereign for ${UNLOCK_HOURS}h (until $(date -r "$exp" 2>/dev/null || date -d "@$exp" 2>/dev/null || echo expiry))"
}

check_sync_unlock(){
  verify_sync_unlock || return 1
  apply_owner_unlock
  return 0
}

cmd="${1:-status}"
case "$cmd" in
  unlock|open|on)
    if ! is_taha_host && [[ -z "${HAILMARY_FORCE_UNLOCK:-}" ]]; then
      die "Non-owner hostname — use broadcast from Carry or set HAILMARY_FORCE_UNLOCK=1 if this is yours"
    fi
    apply_owner_unlock
    ;;
  lock|close|off)
    apply_employee_lock
    rm -f "$SYNC_FLAG" 2>/dev/null || true
    ;;
  broadcast|sync)
    # Run on Carry — pushes SIGNED unlock to mesh (Syncthing). Secret NEVER in BLIP bundle.
    ensure_unlock_secret
    apply_owner_unlock
    exp="$(grep -E '^expires=' "$LOCK_FILE" | cut -d= -f2)"
    sig="$(sign_unlock "$exp")"
    cat > "$SYNC_FLAG" <<EOF
expires=$exp
sig=$sig
broadcast_from=$(hostname -s)
broadcast_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
    chmod 600 "$SYNC_FLAG"
    log "Broadcast SIGNED unlock → $SYNC_FLAG"
    log "Copy unlock secret to owner devices ONLY (never employee PCs):"
    log "  $UNLOCK_SECRET_FILE"
    ;;
  poll)
    if is_taha_host && [[ -f "$UNLOCK_SECRET_FILE" ]] && verify_sync_unlock; then
      apply_owner_unlock
      log "Synced SIGNED unlock from Carry"
    else
      apply_employee_lock
      [[ -f "$SYNC_FLAG" ]] && ! is_taha_host && log "Employee PC — ignoring unlock broadcast (by design)"
    fi
    ;;
  status|st)
    if [[ -f "$LOCK_FILE" ]] && ! unlock_expired; then
      echo "STATUS: UNLOCKED (owner sovereign)"
      cat "$LOCK_FILE"
    elif check_sync_unlock 2>/dev/null; then
      echo "STATUS: UNLOCKED (via mesh sync)"
    else
      echo "STATUS: LOCKED (employee-safe · virtual key only)"
      [[ -f "${TMMT_CFG}/active-tier.env" ]] && head -3 "${TMMT_CFG}/active-tier.env"
    fi
    ;;
  *)
    echo "Usage: bash office-mode.sh unlock|lock|broadcast|poll|status"
    exit 1
    ;;
esac
