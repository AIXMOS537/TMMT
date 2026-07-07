#!/bin/bash
# FAMILY VAULT COMPILER — Iron Man mode.
# Compiles all important Taha + family data into ONE encrypted vault (AES-256).
# Key lives in the login Keychain (Secure Enclave). Auto-unlocks ONLY when Taha is
# logged into this Mac; a locked brick to anyone else. Runs nightly via launchd.
set -u
LOG="$HOME/.tmmt/family-vault.log"
STAMP() { date "+%Y-%m-%d %H:%M:%S"; }
say() { echo "[$(STAMP)] $*" >> "$LOG"; }

SVC="tmmt-family-vault"; ACCT="ceo.moe"
BUNDLE="$HOME/FamilyVault.sparsebundle"
VOL="/Volumes/FamilyVault"
STAGE="$HOME/.tmmt/family-vault-stage"

# 1) get key from Keychain (non-interactive when Taha is logged in; fails safe if locked)
KEY=$(security find-generic-password -s "$SVC" -a "$ACCT" -w 2>/dev/null)
if [ -z "$KEY" ]; then say "ABORT: vault key not accessible (Mac locked or key missing) — nothing exposed"; exit 0; fi

# 2) create the encrypted vault once (256GB sparse cap, only grows as used)
if [ ! -d "$BUNDLE" ]; then
  printf '%s' "$KEY" | hdiutil create -encryption AES-256 -stdinpass \
    -type SPARSEBUNDLE -fs APFS -size 256g -volname FamilyVault "$BUNDLE" >>"$LOG" 2>&1 \
    && say "created encrypted FamilyVault.sparsebundle" || { say "ABORT: create failed"; unset KEY; exit 1; }
fi

# 3) mount it
if [ ! -d "$VOL" ]; then
  printf '%s' "$KEY" | hdiutil attach -stdinpass -mountpoint "$VOL" "$BUNDLE" >>"$LOG" 2>&1 \
    || { say "ABORT: mount failed"; unset KEY; exit 1; }
fi
unset KEY

# 4) compile — snapshot the important stuff into the vault (rsync = fast incremental)
mkdir -p "$VOL/brain" "$VOL/phones" "$VOL/config" "$VOL/memory" "$VOL/family"
rsync -a --delete --exclude '.git' "$HOME/Brain/vault/" "$VOL/brain/" 2>>"$LOG"
rsync -a "$HOME/.claude/projects/-Users-ceo-moe/memory/" "$VOL/memory/" 2>>"$LOG"
rsync -a "$HOME/.config/tmmt/" "$VOL/config/" 2>>"$LOG"            # secrets live encrypted here, never in git
# compiled phone data (mined findings) from every phone scan
for m in "$HOME"/iPhoneScan-*/_mined; do
  [ -d "$m" ] || continue
  dev=$(basename "$(dirname "$m")")
  rsync -a "$m/" "$VOL/phones/$dev/" 2>>"$LOG"
done

echo "$(STAMP)" > "$VOL/LAST-COMPILE.txt"
du -sh "$VOL" 2>/dev/null | awk '{print "vault size: "$1}' >> "$LOG"

# 5) unmount (locked again). detach quietly.
hdiutil detach "$VOL" >>"$LOG" 2>&1 && say "compiled + relocked FamilyVault"

# 6) stage encrypted bundle for offsite replication (NAS/BRAINIAC via Syncthing when up)
if [ -d "$HOME/Sync" ]; then
  ln -sf "$BUNDLE" "$HOME/Sync/FamilyVault.sparsebundle" 2>/dev/null
fi
say "done"
