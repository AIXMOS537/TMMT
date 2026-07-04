#!/bin/bash
# voice-inbox-watch.sh — Operation Overdrive voice-capture watcher.
# Runs via launchd (com.tmmt.voice-inbox, StartInterval 30).
# superwhisper / Shortcuts drop voice-memo audio or transcript text into
# ~/.tmmt/inbox (see scripts/catch header). Each file is:
#   audio  -> transcribed locally with whisper.cpp (ggml-small.en)
#   text   -> used as-is
# then the transcript is (1) saved durably into the git-backed vault at
# ~/Brain/vault/99-Inbox/voice-transcripts/ and (2) routed through
# scripts/catch, which parses it into Overdrive board tasks.
#
# Rebuilt 2026-07-03 after the untracked original was wiped by live automation
# (dist-volatility incident) — now committed to the repo.
# launchd starts with a bare PATH; the export below is what keeps this from
# dying with exit 127 like the original did.

set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

INBOX="$HOME/.tmmt/inbox"
PROCESSED="$HOME/.tmmt/inbox-processed"
FAILED="$HOME/.tmmt/inbox-failed"
VAULT_DROP="$HOME/Brain/vault/99-Inbox/voice-transcripts"
REPO="$HOME/Projects/TMMT"
MODEL="$HOME/.cache/whisper-models/ggml-small.en.bin"
LOCK="$HOME/.tmmt/.voice-inbox.lock"

mkdir -p "$INBOX" "$PROCESSED" "$FAILED" "$VAULT_DROP"

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

transcribe() { # $1 = audio file -> transcript on stdout
  local wav="${TMPDIR:-/tmp}/voice-inbox-$$.wav"
  ffmpeg -hide_banner -loglevel error -y -i "$1" -ar 16000 -ac 1 "$wav" || { rm -f "$wav"; return 1; }
  whisper-cli -m "$MODEL" -f "$wav" -np -nt 2>/dev/null
  local rc=$?
  rm -f "$wav"
  return $rc
}

shopt -s nullglob
for f in "$INBOX"/*; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  case "$base" in .*) continue ;; esac

  # skip files still being written (modified <5s ago)
  age=$(( $(date +%s) - $(stat -f %m "$f") ))
  [ "$age" -lt 5 ] && continue

  ext="${base##*.}"
  ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
  text=""
  case "$ext" in
    m4a|wav|mp3|caf|aiff|aif|ogg|flac|mp4|mov|webm)
      log "transcribing $base"
      if ! text="$(transcribe "$f")"; then
        log "TRANSCRIBE FAILED: $base"
        mv "$f" "$FAILED/"
        continue
      fi
      ;;
    txt|md)
      text="$(cat "$f")"
      ;;
    *)
      log "unsupported type, parking: $base"
      mv "$f" "$FAILED/"
      continue
      ;;
  esac

  if [ -z "$(printf '%s' "$text" | tr -d '[:space:]')" ]; then
    log "empty transcript: $base"
    mv "$f" "$FAILED/"
    continue
  fi

  # Durable copy first — vault is git-backed, survives repo wipes.
  stamp="$(date +%Y%m%d-%H%M%S)"
  note="$VAULT_DROP/$stamp-${base%.*}.md"
  {
    echo "# Voice capture — $stamp"
    echo
    echo "source: $base"
    echo
    printf '%s\n' "$text"
  } > "$note"

  # Route into the Overdrive task board.
  if printf '%s' "$text" | "$REPO/scripts/catch"; then
    log "routed $base -> catch + $note"
    mv "$f" "$PROCESSED/"
  else
    log "CATCH FAILED for $base (transcript saved: $note)"
    mv "$f" "$FAILED/"
  fi
done

exit 0
