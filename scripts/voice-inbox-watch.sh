#!/bin/bash
# voice-inbox-watch.sh — Operation Overdrive voice/media capture watcher.
# Runs via launchd (com.tmmt.voice-inbox, StartInterval 30).
#
# TWO LANES:
#   TASK lane   — ~/.tmmt/inbox            + iCloud Drive/VoiceDrop
#                 voice memo -> transcript -> vault copy -> scripts/catch
#                 (parsed into Overdrive board tasks)
#   MEDIA lane  — ~/.tmmt/media-inbox      + iCloud Drive/MediaDrop
#                 any video/audio (IG saves, Snapchat exports, iPhone videos)
#                 -> transcript -> vault knowledge only, NO task routing
#
# iPhone flow: share sheet -> Save to Files -> VoiceDrop or MediaDrop.
# Audio/video transcribed locally with whisper.cpp (ggml-small.en);
# .txt/.md pass through as-is. Transcripts land git-backed in
# ~/Brain/vault/99-Inbox/voice-transcripts/ (tasks) and
# ~/Brain/vault/99-Inbox/media-transcripts/ (knowledge).
#
# Rebuilt 2026-07-03 after the untracked original was wiped by live automation
# (dist-volatility incident) — now committed to the repo. launchd starts with
# a bare PATH; the export below is what keeps this from dying with exit 127.

set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

TASK_INBOX="$HOME/.tmmt/inbox"
MEDIA_INBOX="$HOME/.tmmt/media-inbox"
ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
ICLOUD_VOICE="$ICLOUD/VoiceDrop"
ICLOUD_MEDIA="$ICLOUD/MediaDrop"
PROCESSED="$HOME/.tmmt/inbox-processed"
FAILED="$HOME/.tmmt/inbox-failed"
VAULT_TASKS="$HOME/Brain/vault/99-Inbox/voice-transcripts"
VAULT_MEDIA="$HOME/Brain/vault/99-Inbox/media-transcripts"
REPO="$HOME/Projects/TMMT"
MODEL="$HOME/.cache/whisper-models/ggml-small.en.bin"
LOCK="$HOME/.tmmt/.voice-inbox.lock"

mkdir -p "$TASK_INBOX" "$MEDIA_INBOX" "$PROCESSED" "$FAILED" \
         "$VAULT_TASKS" "$VAULT_MEDIA" "$ICLOUD_VOICE" "$ICLOUD_MEDIA"

# One run at a time — a long transcription can outlive the 30s interval.
if ! mkdir "$LOCK" 2>/dev/null; then
  # clear a stale lock (>30 min), otherwise yield to the running instance
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
    rmdir "$LOCK" 2>/dev/null || true
  fi
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Nudge iCloud to materialize any dataless files in the drop folders.
# Placeholders (".name.icloud") are dotfiles and get skipped until real.
brctl download "$ICLOUD_VOICE" 2>/dev/null || true
brctl download "$ICLOUD_MEDIA" 2>/dev/null || true

transcribe() { # $1 = audio/video file -> transcript on stdout
  local wav="${TMPDIR:-/tmp}/voice-inbox-$$.wav"
  ffmpeg -hide_banner -loglevel error -y -i "$1" -vn -ar 16000 -ac 1 "$wav" || { rm -f "$wav"; return 1; }
  whisper-cli -m "$MODEL" -f "$wav" -np -nt 2>/dev/null
  local rc=$?
  rm -f "$wav"
  return $rc
}

process_dir() { # $1 = inbox dir, $2 = lane (task|media)
  local dir="$1" lane="$2" f base age ext text stamp note vault
  [ -d "$dir" ] || return 0
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    case "$base" in .*) continue ;; esac

    # skip files still being written / still syncing (modified <5s ago)
    age=$(( $(date +%s) - $(stat -f %m "$f") ))
    [ "$age" -lt 5 ] && continue

    ext="${base##*.}"
    ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
    text=""
    case "$ext" in
      m4a|wav|mp3|caf|aiff|aif|ogg|flac|opus|amr|mp4|mov|m4v|webm|mkv|avi|3gp)
        log "[$lane] transcribing $base"
        if ! text="$(transcribe "$f")"; then
          log "[$lane] TRANSCRIBE FAILED: $base"
          mv -f "$f" "$FAILED/"
          continue
        fi
        ;;
      txt|md)
        text="$(cat "$f")"
        ;;
      *)
        log "[$lane] unsupported type, parking: $base"
        mv -f "$f" "$FAILED/"
        continue
        ;;
    esac

    if [ -z "$(printf '%s' "$text" | tr -d '[:space:]')" ]; then
      log "[$lane] empty transcript: $base"
      mv -f "$f" "$FAILED/"
      continue
    fi

    # Durable copy first — vault is git-backed, survives repo wipes.
    stamp="$(date +%Y%m%d-%H%M%S)"
    vault="$VAULT_MEDIA"; [ "$lane" = "task" ] && vault="$VAULT_TASKS"
    note="$vault/$stamp-${base%.*}.md"
    {
      echo "# ${lane} capture — $stamp"
      echo
      echo "source: $base"
      echo
      printf '%s\n' "$text"
    } > "$note"

    if [ "$lane" = "task" ]; then
      # Route into the Overdrive task board.
      if printf '%s' "$text" | "$REPO/scripts/catch"; then
        log "[task] routed $base -> catch + $note"
        mv -f "$f" "$PROCESSED/"
      else
        log "[task] CATCH FAILED for $base (transcript saved: $note)"
        mv -f "$f" "$FAILED/"
      fi
    else
      log "[media] transcribed $base -> $note"
      mv -f "$f" "$PROCESSED/"
    fi
  done
}

process_dir "$TASK_INBOX"   task
process_dir "$ICLOUD_VOICE" task
process_dir "$MEDIA_INBOX"  media
process_dir "$ICLOUD_MEDIA" media

exit 0
