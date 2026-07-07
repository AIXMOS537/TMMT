#!/usr/bin/env bash
# empire-cleanup.sh — ONE canonical copy everywhere. Dupes archived. Trash emptied.
#
#   bash scripts/empire-cleanup.sh           # dry-run (shows plan)
#   bash scripts/empire-cleanup.sh --apply   # execute
#   bash scripts/empire-cleanup.sh --apply --empty-trash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY=0
EMPTY_TRASH=0
ARCHIVE="$HOME/.config/tmmt/.empire-cleanup-$(date +%Y%m%d-%H%M%S)"
REPORT="$ARCHIVE/CLEANUP-REPORT.txt"

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --empty-trash) EMPTY_TRASH=1 ;;
  esac
done

mkdir -p "$ARCHIVE"
exec > >(tee -a "$REPORT") 2>&1

say(){ printf '\n▶ %s\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }
plan(){ printf '  [plan] %s\n' "$*"; }
do_mv(){
  local src="$1" dst="$2"
  [[ -e "$src" ]] || return 0
  [[ -L "$src" ]] && return 0
  if [[ "$APPLY" -eq 1 ]]; then
    mkdir -p "$(dirname "$dst")"
    mv -f "$src" "$dst" && ok "archived: $(basename "$src")"
  else
    plan "archive: $src → $dst"
  fi
}

expand(){ eval echo "$1"; }

say "EMPIRE CLEANUP — mode: $([[ $APPLY -eq 1 ]] && echo APPLY || echo DRY-RUN)"
echo "Archive: $ARCHIVE"

# ── 1. Restore Carry role if wrong ──
if [[ -f "$ROOT/.swarm/role" ]] && grep -q '^rick$' "$ROOT/.swarm/role" 2>/dev/null; then
  if [[ "$APPLY" -eq 1 ]]; then
    bash "$ROOT/scripts/restore-carry-watchtower.sh" 2>/dev/null || true
  else
    plan "restore carry watchtower (role was rick)"
  fi
fi

# ── 2. Disable wrong M1 agent on Carry ──
M1_PLIST="$HOME/Library/LaunchAgents/com.tmmt.m1-fleet.plist"
if [[ -f "$M1_PLIST" ]]; then
  if [[ "$APPLY" -eq 1 ]]; then
    launchctl unload "$M1_PLIST" 2>/dev/null || true
    mv -f "$M1_PLIST" "$ARCHIVE/com.tmmt.m1-fleet.plist" 2>/dev/null || true
    ok "removed M1 fleet agent from Carry"
  else
    plan "unload com.tmmt.m1-fleet on Carry"
  fi
fi

# ── 3. Rebuild canonical send drop (fresh, no dupes) ──
say "Canonical send package"
if [[ "$APPLY" -eq 1 ]]; then
  bash "$ROOT/scripts/make-empire-mesh.sh" 2>/dev/null || bash "$ROOT/scripts/blip/make-ultimate-drop.sh" 2>/dev/null || true
  ok "rebuilt ★ SEND-TO-DEVICES"
else
  plan "rebuild ~/Desktop/★ SEND-TO-DEVICES via make-empire-mesh.sh"
fi

SEND="$(expand '~/Desktop/★ SEND-TO-DEVICES')"
ULT="$(expand '~/Desktop/★ ULTIMATE-DROP')"
BLIP="$(expand '~/Desktop/BLIP-DROP-LATEST')"

# ── 4. Symlinks — one pointer, no duplicate folders ──
say "Symlinks (one truth)"
for pair in "$ULT:$SEND" "$BLIP:$SEND"; do
  link="${pair%%:*}"; target="${pair##*:}"
  [[ -e "$SEND" ]] || continue
  if [[ "$APPLY" -eq 1 ]]; then
    [[ -L "$link" || ! -e "$link" ]] && rm -rf "$link" 2>/dev/null || true
    if [[ ! -e "$link" ]]; then ln -sfn "$SEND" "$link" && ok "link $(basename "$link") → SEND-TO-DEVICES"; fi
  else
    [[ -d "$link" && ! -L "$link" ]] && plan "replace folder $link with symlink to SEND-TO-DEVICES"
    plan "symlink $(basename "$link") → SEND-TO-DEVICES"
  fi
done

SYNC_MESH="$(expand '~/Sync/empire-mesh')"
SYNC_ULT="$(expand '~/Sync/BLIP-DROP/ULTIMATE')"
# Only symlink ULTIMATE → empire-mesh when empire-mesh is a real directory (never a symlink)
if [[ -d "$SYNC_MESH" && ! -L "$SYNC_MESH" ]]; then
  if [[ "$APPLY" -eq 1 ]]; then
    rm -rf "$SYNC_ULT" 2>/dev/null || true
    ln -sfn "$SYNC_MESH" "$SYNC_ULT" 2>/dev/null && ok "Sync BLIP-DROP/ULTIMATE → empire-mesh"
  else
    plan "symlink ~/Sync/BLIP-DROP/ULTIMATE → ~/Sync/empire-mesh"
  fi
fi

# ── 5. Archive stale Desktop duplicates ──
say "Desktop — archive stale packs"
DESK_ARCHIVE="$ARCHIVE/Desktop"
for glob in \
  "BLIP-DROP-LATEST 2" \
  "M1-ONE-SHOT-FOREVER" \
  "BLIP-SEND-TONIGHT" \
  "FABLE-FEED-TONIGHT" \
  "HAILMARY-V3-MASTER" \
  "GO-HOME-PACK" \
  "MOE-LEGACY-DELIVER" \
  "MOE-TEAM-POWERHOUSE-KIT"; do
  for path in "$HOME/Desktop"/$glob; do
    [[ -e "$path" ]] || continue
    do_mv "$path" "$DESK_ARCHIVE/$(basename "$path")"
  done
done
for path in "$HOME/Desktop"/CARRY-FLEET-STATUS-*.txt; do
  [[ -f "$path" ]] || continue
  do_mv "$path" "$DESK_ARCHIVE/$(basename "$path")"
done

# Phase 2 — loose Desktop dupes / legacy launchers (archive, not delete)
for glob in \
  "M1-GO" \
  "Launchers" \
  "AIXMOS-RELAUNCH" \
  "INVESTOR_MEETING_NOW" \
  "BLIP-DROP-LATEST 2" \
  "MOE-ONE-SHOT.sh" \
  "MOE.command" \
  "ONE-SHOT-ALL-DEVICES.md" \
  "ONE-SHOT-ALL-DEVICES-STATUS.txt" \
  "ONE-SHOT-LIVE-STATUS.txt" \
  "ONE-SHOT-FOREVER.txt" \
  "ONE-SHOT-LOOP.command" \
  "ONE-SHOT-LOOP.sh" \
  "ONE-SHOT.command" \
  "LOOP-ONE-LINE.txt" \
  "LOOP-ONE-SHOT-PASTE.txt" \
  "DROP.sh" \
  "M1-NOW.sh" \
  "MESSAGE-TO-MOE-DELIVERY.md" \
  "★ ULTIMATE-DROP 2" \
  "SEND-TO-MOE-M1-AIR" \
  "SEND-TO-MOE-M1-AIR.zip" \
  "ONE-SHOT.sh" \
  "ONE-SHOT.txt" \
  "Operator Kits" \
  "TMMT-OPERATOR-LAUNCH" \
  "OPERATOR-PITCH-SEND-TODAY" \
  "INSTALL-RICK-AWAY-ON-M1.command" \
  "★ ONE-SHOT ALL DEVICES.command" \
  "★ FOREVER — DO THIS ONCE.txt" \
  "MOE.command"; do
  for path in "$HOME/Desktop"/$glob; do
    [[ -e "$path" ]] || continue
    do_mv "$path" "$DESK_ARCHIVE/$(basename "$path")"
  done
done

# Recreate symlinks after any rebuild archived them
if [[ -d "$SEND" && "$APPLY" -eq 1 ]]; then
  ln -sfn "$SEND" "$ULT" 2>/dev/null && ok "link ★ ULTIMATE-DROP → SEND-TO-DEVICES"
  ln -sfn "$SEND" "$BLIP" 2>/dev/null && ok "link BLIP-DROP-LATEST → SEND-TO-DEVICES"
fi

# ── 6. Archive stale Sync BLIP dupes ──
say "Sync — archive superseded BLIP copies"
for rel in "BLIP-DROP/LATEST" "BLIP-DROP/M1-ONE-SHOT-FOREVER"; do
  path="$HOME/Sync/$rel"
  [[ -e "$path" && ! -L "$path" ]] && do_mv "$path" "$ARCHIVE/Sync/$(basename "$(dirname "$path")")-$(basename "$path")"
done

# ── 7. FLEET-INBOX dedupe (content hash) ──
say "FLEET-INBOX — dedupe missions"
INBOX="$HOME/Sync/rick/FLEET-INBOX"
DEDUPE_DIR="$INBOX/_deduped-$(date +%Y%m%d)"
if [[ -d "$INBOX" ]] && command -v shasum >/dev/null 2>&1; then
  count=0
  seen_file="$(mktemp)"
  trap 'rm -f "$seen_file"' EXIT
  while IFS= read -r -d '' f; do
    [[ -f "$f" ]] || continue
    h="$(shasum -a 256 "$f" | awk '{print $1}')"
    base="$(basename "$f")"
    if grep -qxF "$h" "$seen_file" 2>/dev/null; then
      if [[ "$APPLY" -eq 1 ]]; then
        mkdir -p "$DEDUPE_DIR"
        mv -f "$f" "$DEDUPE_DIR/$base" 2>/dev/null && count=$((count+1))
      else
        plan "dedupe inbox: $base"
        count=$((count+1))
      fi
    else
      echo "$h" >> "$seen_file"
    fi
  done < <(find "$INBOX" -maxdepth 1 -name '*.md' -type f -print0 2>/dev/null)
  rm -f "$seen_file"
  trap - EXIT
  ok "inbox dupes: $count"
fi

# ── 8. Intake folder dedupe ──
say "OWNER-WORK-INTAKE — dedupe"
INTAKE="$HOME/Brain/vault/00-Dashboard/OWNER-WORK-INTAKE"
if [[ -d "$INTAKE" ]] && command -v shasum >/dev/null 2>&1; then
  seen_intake="$(mktemp)"
  trap 'rm -f "$seen_intake"' EXIT
  while IFS= read -r -d '' f; do
    h="$(shasum -a 256 "$f" | awk '{print $1}')"
    if grep -qxF "$h" "$seen_intake" 2>/dev/null; then
      do_mv "$f" "$ARCHIVE/intake/$(basename "$f")"
    else
      echo "$h" >> "$seen_intake"
    fi
  done < <(find "$INTAKE" -type f \( -name '*.md' -o -name '*.txt' \) -print0 2>/dev/null)
  rm -f "$seen_intake"
  trap - EXIT
fi

# ── 9. Purge stale launch agents (sovereign stack only) ──
say "LaunchAgents — sovereign stack only"
if [[ "$APPLY" -eq 1 && -x "$ROOT/scripts/blip/purge-and-go.sh" ]]; then
  # purge-and-go archives stale agents; skip full DROP to avoid disruption
  ARCHIVE_SAVE="$ARCHIVE"
  bash -c '
    source() { :; }
    ARCHIVE="'"$ARCHIVE_SAVE"'"
    # inline agent purge from purge-and-go
    KEEP="com.tmmt.forever-loop com.tmmt.router com.tmmt.memory-sync com.tmmt.voice-inbox com.tmmt.heartbeat-watch com.tmmt.sovereign-login com.tmmt.empire-intake com.aixmos.carry-watcher com.aixmos.hailmary com.hailmary.litellm-local com.hailmary.ccr"
    la="$HOME/Library/LaunchAgents"
    mkdir -p "$ARCHIVE/LaunchAgents"
    for plist in "$la"/*.plist; do
      [[ -f "$plist" ]] || continue
      base="$(basename "$plist" .plist)"
      keep=0
      for k in $KEEP; do [[ "$base" == "$k" ]] && keep=1; done
      [[ $keep -eq 1 ]] && continue
      case "$base" in com.tmmt.*|com.aixmos.*|com.hailmary.*|com.sork.*) ;;
        *) continue ;; esac
      launchctl unload "$plist" 2>/dev/null || true
      mv -f "$plist" "$ARCHIVE/LaunchAgents/" 2>/dev/null || true
      echo "  removed agent: $base"
    done
  ' || true
  ok "LaunchAgents cleaned"
else
  plan "purge stale LaunchAgents (keep forever-loop, empire-intake, voice-inbox)"
fi

# ── 10. X-FOREVER canonical in ~/.config/tmmt only ──
say "Config — canonical scripts"
XSRC="$HOME/Desktop/X-FOREVER"
TMMT_CFG="$HOME/.config/tmmt"
if [[ -d "$XSRC" ]]; then
  mkdir -p "$TMMT_CFG"
  for f in forge.sh x-forever.sh god-mode.sh booyah.sh access-tiers.env; do
    [[ -f "$XSRC/$f" ]] && { [[ "$APPLY" -eq 1 ]] && cp -f "$XSRC/$f" "$TMMT_CFG/" && chmod +x "$TMMT_CFG/$f" 2>/dev/null; plan "sync $f → ~/.config/tmmt"; }
  done
  ok "X-FOREVER → ~/.config/tmmt (Desktop copy is optional AirDrop source)"
fi

# ── 11. Empty Trash ──
say "Trash"
TRASH_SIZE="$(du -sh "$HOME/.Trash" 2>/dev/null | awk '{print $1}' || echo '?')"
if [[ "$EMPTY_TRASH" -eq 1 || "$APPLY" -eq 1 ]]; then
  if [[ "$APPLY" -eq 1 ]]; then
    osascript -e 'tell application "Finder" to empty trash' 2>/dev/null \
      || rm -rf "$HOME/.Trash"/* 2>/dev/null || true
    ok "Trash emptied (was $TRASH_SIZE)"
  else
    plan "empty Trash (was $TRASH_SIZE) — use --apply --empty-trash"
  fi
else
  plan "Trash $TRASH_SIZE — add --empty-trash to empty"
fi

# ── 12. Write canon card on Desktop ──
CANON_CARD="$HOME/Desktop/★ EMPIRE-CANON.txt"
cat > "$CANON_CARD" <<'CARD'
EMPIRE CANON — one copy only (updated by empire-cleanup.sh)
===========================================================

SEND TO DEVICES:  ~/Desktop/★ SEND-TO-DEVICES  (AirDrop this)
SYNC COPY:        ~/Sync/empire-mesh
CODE:             ~/Projects/TMMT
FLEET:            ~/Sync/rick/FLEET-INBOX
SECRETS:          ~/.config/tmmt  (never in drops)
VAULT:            ~/Brain/vault

SYMLINKS (not duplicate folders):
  ★ ULTIMATE-DROP      → ★ SEND-TO-DEVICES
  BLIP-DROP-LATEST     → ★ SEND-TO-DEVICES

REBUILD SEND DROP:  x send
CLEAN AGAIN:        bash ~/Projects/TMMT/scripts/empire-cleanup.sh --apply --empty-trash
CARD

say "DONE"
cat <<DONE

╔══════════════════════════════════════════════════════════════╗
║  EMPIRE CLEANUP $([[ $APPLY -eq 1 ]] && echo COMPLETE || echo PLANNED)                       ║
╠══════════════════════════════════════════════════════════════╣
║  One send folder:  ~/Desktop/★ SEND-TO-DEVICES               ║
║  One sync copy:    ~/Sync/empire-mesh                         ║
║  Dupes archived:   $ARCHIVE
║  Canon card:       ~/Desktop/★ EMPIRE-CANON.txt               ║
╠══════════════════════════════════════════════════════════════╣
║  Run for real:  bash scripts/empire-cleanup.sh --apply --empty-trash
╚══════════════════════════════════════════════════════════════╝

DONE
