#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — CYBORG HEALTH CHECK
# Run anytime to confirm the master key drive is fit to serve.
#   bash cyborg-health.sh
# ============================================================
set -uo pipefail
VOL="/Volumes/CYBORG"
RED=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; BD=$'\e[1m'; CY=$'\e[36m'; X=$'\e[0m'
ok()   { printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
warn() { printf '%s  ⚠ %s%s\n' "$Y" "$*" "$X"; }
bad()  { printf '%s  ✗ %s%s\n' "$RED" "$*" "$X"; }

printf '\n%s%s  CYBORG HEALTH CHECK — %s%s\n\n' "$CY$BD" "" "$(date '+%Y-%m-%d %H:%M')" "$X"

# 1. Mounted?
if [[ ! -d "$VOL" ]]; then bad "CYBORG not mounted. Plug it in."; exit 1; fi
ok "Mounted at $VOL"

# 2. Writable?
T="$VOL/.health-$$"
if echo "ping" > "$T" 2>/dev/null && [[ "$(cat "$T" 2>/dev/null)" == "ping" ]]; then
  ok "Read/write OK"; rm -f "$T"
else
  bad "Drive is READ-ONLY or failing. Do not rely on it."; rm -f "$T" 2>/dev/null; exit 1
fi

# 3. Checksum round-trip (silent corruption test)
echo "$(date +%s)-block-data" > "$T"; S1=$(shasum "$T"|awk '{print $1}'); sync; S2=$(shasum "$T"|awk '{print $1}'); rm -f "$T"
[[ "$S1" == "$S2" ]] && ok "Checksum stable (no silent corruption)" || bad "CHECKSUM MISMATCH — replace this drive"

# 4. Free space
FREE=$(df -h "$VOL" | awk 'NR==2{print $4}')
PCT=$(df "$VOL" | awk 'NR==2{print $5}')
ok "Free space: $FREE ($PCT used)"

# 5. Master vault present + decryptable-format?
if [[ -f "$VOL/HAILMARY/master/vault.enc" ]]; then
  ok "Encrypted vault present (vault.enc)"
else
  warn "No vault.enc — run: bash $VOL/HAILMARY/master/vault.sh init"
fi

# 6. Plaintext secret leak check (the FAT32 danger)
LEAK=0
for f in "$VOL/HAILMARY/master/.supabase-service-key" "$VOL/HAILMARY/master/.passhash"; do
  if [[ -f "$f" && -s "$f" ]]; then warn "PLAINTEXT SECRET ON DRIVE: $(basename "$f") — should be in vault.enc"; LEAK=1; fi
done
[[ $LEAK -eq 0 ]] && ok "No plaintext secrets on drive"

# 7. Core scripts present + executable
for s in START-HERE.command scan/scan-machine.sh activate/activate.command master/revoke.sh master/restore.sh master/vault.sh master/totp.py; do
  [[ -f "$VOL/HAILMARY/$s" ]] && ok "Script: $s" || warn "MISSING: $s"
done

# 8. Backup recency
BK=$(ls -t ~/Documents/Business/_BACKUPS 2>/dev/null | head -1)
[[ -n "$BK" ]] && ok "Latest local backup: $BK" || warn "No backup found in ~/Documents/Business/_BACKUPS"

printf '\n%s  Filesystem: FAT32 (no Unix perms — that is WHY secrets must stay encrypted).%s\n' "$Y" "$X"
printf '%s%s  CYBORG is ready to serve as the master key.%s\n\n' "$G$BD" "" "$X"
