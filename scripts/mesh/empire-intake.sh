#!/usr/bin/env bash
# empire-intake.sh — collect EVERYTHING new → route to Rick/M1. No human unless emergency.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

INTAKE="$HOME/Brain/vault/00-Dashboard/OWNER-WORK-INTAKE"
RICK_INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
LOG="$HOME/Library/Logs/empire-intake.log"
MARKER="$HOME/.config/tmmt/.empire-intake-last"
mkdir -p "$INTAKE/business" "$INTAKE/work" "$(dirname "$LOG")"

log(){ printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >> "$LOG"; }

# 1) Voice / media / iCloud drops (photos, voice memos, screen recordings)
[[ -x "$ROOT/scripts/voice-inbox-watch.sh" ]] \
  && bash "$ROOT/scripts/voice-inbox-watch.sh" >> "$LOG" 2>&1 || true

# 2) New vault transcripts → business intake
for dir in \
  "$HOME/Brain/vault/99-Inbox/voice-transcripts" \
  "$HOME/Brain/vault/99-Inbox/media-transcripts"; do
  [[ -d "$dir" ]] || continue
  find "$dir" -type f -name '*.md' -mmin -120 2>/dev/null | while read -r f; do
    base="$(basename "$f")"
    dest="$INTAKE/business/capture-$base"
    [[ -f "$dest" ]] && continue
    cp -f "$f" "$dest" 2>/dev/null && log "vault capture → intake: $base"
  done
done

# 3) Task inbox files not yet routed
for dir in "$HOME/.tmmt/inbox" "$HOME/.tmmt/inbox-failed"; do
  [[ -d "$dir" ]] || continue
  find "$dir" -type f \( -name '*.md' -o -name '*.txt' \) -mmin -120 2>/dev/null | while read -r f; do
    base="$(basename "$f")"
    dest="$INTAKE/work/inbox-$base"
    [[ -f "$dest" ]] && continue
    cp -f "$f" "$dest" 2>/dev/null && log "tmmt inbox → intake: $base"
  done
done

# 4) ClickUp open tasks → intake
if [[ -f "$ROOT/scripts/mesh/clickup-intake.mjs" ]]; then
  node "$ROOT/scripts/mesh/clickup-intake.mjs" >> "$LOG" 2>&1 || log "clickup intake skip"
fi

# 5) Route all intake → FLEET-INBOX (M1 WORK LAW)
[[ -x "$ROOT/scripts/mesh/m1-work-router.sh" ]] \
  && bash "$ROOT/scripts/mesh/m1-work-router.sh" route >> "$LOG" 2>&1 || true

# 6) Escalations only ping owner; everything else autonomous
if [[ -d "$RICK_INBOX/ESCALATED" ]]; then
  find "$RICK_INBOX/ESCALATED" -maxdepth 1 -name '*.md' -mmin -30 -type f 2>/dev/null | while read -r f; do
    if grep -qiE 'EMERGENCY|HARD.STOP|SECURITY|LEGAL' "$f" 2>/dev/null; then
      bash "$ROOT/scripts/mesh/notify-owner.sh" emergency "$(basename "$f")" >> "$LOG" 2>&1 || true
    else
      bash "$ROOT/scripts/mesh/notify-owner.sh" log "escalated: $(basename "$f")" >> "$LOG" 2>&1 || true
    fi
  done
fi

# 7) Operator dispatch (available + in-area from registry)
[[ -x "$ROOT/scripts/mesh/operator-dispatch.sh" ]] \
  && bash "$ROOT/scripts/mesh/operator-dispatch.sh" scan >> "$LOG" 2>&1 || true

date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"
log "empire-intake tick complete"
exit 0
