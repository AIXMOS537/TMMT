#!/usr/bin/env bash
# vault-backup — encrypted OFFSITE backup of the brain's memory/vault.
#
# memory-sync.sh keeps a LOCAL copy (M1 → home vault on BRAINIAC). That protects
# against a dead laptop — but NOT against fire, theft, or the house going down.
# This pushes an ENCRYPTED snapshot off-property. Encryption is mandatory: the
# blob is unreadable without your key, so the offsite target can be any cloud.
#
#   bash scripts/mesh/vault-backup.sh once          back up now (encrypt + push)
#   bash scripts/mesh/vault-backup.sh install        macOS LaunchAgent (daily)
#   bash scripts/mesh/vault-backup.sh uninstall
#   bash scripts/mesh/vault-backup.sh status
#   bash scripts/mesh/vault-backup.sh restore-help   how to decrypt a snapshot
#
# Config (env — set in your shell profile, NEVER commit values):
#   VAULT_BACKUP_SRC        dirs to back up (space-sep). Default: .hailmary/memory
#                           + $HAILMARY_VAULT_LOCAL if set.
#   Encryption (pick ONE):
#     VAULT_BACKUP_AGE_RECIPIENT   an age public key (recommended: age1...).
#     VAULT_BACKUP_PASSPHRASE      a passphrase (age symmetric; simpler, weaker).
#   Destination (pick ONE):
#     VAULT_BACKUP_RCLONE_REMOTE   e.g. "b2:tmmt-brain-backups" (any rclone remote).
#     VAULT_BACKUP_DEST_DIR        a local/offsite mounted path (e.g. an external SSD).
#
# Nothing secret is written to the repo. Memory snapshots are already
# secret-scrubbed at capture by scripts/hailmary.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"

LABEL="com.tmmt.vault-backup"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
WORK="$SWARM_ROOT/.hailmary/backup"
LOG="$SWARM_ROOT/.hailmary/vault-backup.log"

sources() {
  local list="${VAULT_BACKUP_SRC:-}"
  [[ -n "$list" ]] || list="$SWARM_ROOT/.hailmary/memory${HAILMARY_VAULT_LOCAL:+ $HAILMARY_VAULT_LOCAL}"
  printf '%s' "$list"
}

do_backup() {
  mkdir -p "$WORK"
  local srcs; srcs="$(sources)"
  local existing=() s
  for s in $srcs; do [[ -e "$s" ]] && existing+=("$s"); done
  [[ ${#existing[@]} -gt 0 ]] || { warn "no backup sources exist yet ($srcs) — nothing to do."; return 0; }

  # Encryption is required. Prefer age (recipient or passphrase).
  command -v age >/dev/null 2>&1 || die "age not found — install it (brew install age) for encrypted backups."
  local stamp tar enc
  stamp="$(date +%Y%m%d-%H%M%S)"
  tar="$WORK/vault-$stamp.tar.gz"
  enc="$tar.age"

  tar -czf "$tar" "${existing[@]}" 2>>"$LOG" || die "tar failed — see $LOG"

  if [[ -n "${VAULT_BACKUP_AGE_RECIPIENT:-}" ]]; then
    age -r "$VAULT_BACKUP_AGE_RECIPIENT" -o "$enc" "$tar" || die "age encrypt failed"
  elif [[ -n "${VAULT_BACKUP_PASSPHRASE:-}" ]]; then
    printf '%s' "$VAULT_BACKUP_PASSPHRASE" | age -p -o "$enc" "$tar" 2>>"$LOG" || die "age encrypt failed"
  else
    rm -f "$tar"
    die "set VAULT_BACKUP_AGE_RECIPIENT or VAULT_BACKUP_PASSPHRASE — refusing to back up UNENCRYPTED offsite."
  fi
  rm -f "$tar"   # never keep the plaintext archive

  # Push the encrypted blob offsite.
  if [[ -n "${VAULT_BACKUP_RCLONE_REMOTE:-}" ]]; then
    command -v rclone >/dev/null 2>&1 || die "rclone not found — install it (brew install rclone)."
    rclone copy "$enc" "$VAULT_BACKUP_RCLONE_REMOTE" >>"$LOG" 2>&1 \
      && ok "offsite backup pushed → $VAULT_BACKUP_RCLONE_REMOTE ($(basename "$enc"))" \
      || die "rclone upload failed — see $LOG"
  elif [[ -n "${VAULT_BACKUP_DEST_DIR:-}" ]]; then
    mkdir -p "$VAULT_BACKUP_DEST_DIR"
    cp "$enc" "$VAULT_BACKUP_DEST_DIR/" \
      && ok "offsite backup copied → $VAULT_BACKUP_DEST_DIR ($(basename "$enc"))" \
      || die "copy to $VAULT_BACKUP_DEST_DIR failed"
  else
    die "set VAULT_BACKUP_RCLONE_REMOTE or VAULT_BACKUP_DEST_DIR — nowhere to send the backup."
  fi

  # Keep the last 7 encrypted blobs locally as a staging cache; prune older.
  ls -1t "$WORK"/vault-*.tar.gz.age 2>/dev/null | tail -n +8 | xargs -r rm -f
}

cmd_install() {
  [[ "$(swarm_os)" == "macos" ]] || die "LaunchAgent is macOS-only. On Linux/Windows use cron/Task Scheduler to run 'vault-backup.sh once' daily."
  mkdir -p "$HOME/Library/LaunchAgents" "$WORK"
  local brewbin=""
  [[ -x /opt/homebrew/bin/brew ]] && brewbin="/opt/homebrew/bin:"
  [[ -x /usr/local/bin/brew ]] && brewbin="${brewbin}/usr/local/bin:"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SWARM_ROOT}/scripts/mesh/vault-backup.sh</string>
    <string>once</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>30</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>WorkingDirectory</key><string>${SWARM_ROOT}</string>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${brewbin}/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
</dict></plist>
PLIST
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST" 2>/dev/null \
    && ok "daily offsite backup installed (03:30). Logs: $LOG" \
    || warn "couldn't load LaunchAgent — load it manually: launchctl load $PLIST"
  warn "Make sure VAULT_BACKUP_* env vars are also exported for the LaunchAgent context (set them in the plist EnvironmentVariables or a loaded profile)."
}

cmd_uninstall() { launchctl unload "$PLIST" 2>/dev/null; rm -f "$PLIST"; ok "daily backup removed."; }
cmd_status() {
  echo "Sources : $(sources)"
  echo "Encrypt : ${VAULT_BACKUP_AGE_RECIPIENT:+age-recipient}${VAULT_BACKUP_PASSPHRASE:+passphrase}${VAULT_BACKUP_AGE_RECIPIENT:-${VAULT_BACKUP_PASSPHRASE:-<UNSET — backups will refuse to run>}}"
  echo "Dest    : ${VAULT_BACKUP_RCLONE_REMOTE:-${VAULT_BACKUP_DEST_DIR:-<UNSET>}}"
  echo "Staged  : $(ls -1 "$WORK"/vault-*.age 2>/dev/null | wc -l | tr -d ' ') encrypted blob(s) in $WORK"
  [[ -f "$LABEL" ]] || true
  launchctl list 2>/dev/null | grep -q "$LABEL" && echo "Schedule: installed (daily 03:30)" || echo "Schedule: not installed"
}
cmd_restore_help() {
  cat <<'EOF'
Restore a snapshot:
  1. Pull the encrypted blob from your offsite remote:
       rclone copy <remote>:vault-YYYYMMDD-HHMMSS.tar.gz.age .
  2. Decrypt:
       age -d -o vault.tar.gz vault-YYYYMMDD-HHMMSS.tar.gz.age   # (age will prompt for passphrase, or use -i your-key)
  3. Unpack:
       tar -xzf vault.tar.gz
Keep your age key / passphrase in your vault (Dashlane). Without it the backup is unreadable — by design.
EOF
}

case "${1:-once}" in
  once)         do_backup ;;
  install)      cmd_install ;;
  uninstall)    cmd_uninstall ;;
  status)       cmd_status ;;
  restore-help) cmd_restore_help ;;
  *) echo "usage: vault-backup.sh [once|install|uninstall|status|restore-help]"; exit 1 ;;
esac
