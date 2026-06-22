#!/usr/bin/env bash
#
# clear-ai-sessions.sh — wipe useless AI chat transcripts/history from Claude
# Code, Codex CLI, and Cursor on THIS Mac. Privacy hygiene: those transcripts can
# contain pasted tokens.
#
# SAFE BY DESIGN:
#   • Dry-run by default (shows sizes; deletes nothing).
#   • --apply archives EVERYTHING to a restorable tarball BEFORE deleting.
#   • NEVER touches logins/config/CLAUDE.md/MCP setup or the brain/repo.
#
# Usage:
#   bash scripts/clear-ai-sessions.sh            # preview (dry-run)
#   bash scripts/clear-ai-sessions.sh --apply    # back up then delete
#   bash scripts/clear-ai-sessions.sh --apply --no-cursor
set -uo pipefail

APPLY=0; DO_CURSOR=1
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1;;
    --no-cursor) DO_CURSOR=0;;
  esac
done

CSUP="$HOME/Library/Application Support/Cursor/User"

# Transcripts/history to clear (NOT config/auth).
TARGETS=(
  "$HOME/.claude/projects"
  "$HOME/.claude/shell-snapshots"
  "$HOME/.claude/todos"
  "$HOME/.claude/history.jsonl"
  "$HOME/.codex/sessions"
  "$HOME/.codex/history.jsonl"
)
if [ "$DO_CURSOR" = "1" ]; then
  TARGETS+=("$CSUP/History" "$CSUP/workspaceStorage")
fi

# NEVER deleted (printed so you can see they're safe).
PRESERVED=(
  "$HOME/.claude/settings.json" "$HOME/.claude/.credentials.json"
  "$HOME/.claude.json" "$HOME/.claude/CLAUDE.md" "$HOME/.claude/commands"
  "$HOME/.codex/config.toml" "$HOME/.codex/auth.json"
  "$HOME/.hailmary"  "(your TMMT repo)"  "(the brain / Supabase)"
)

echo "=== AI session cleaner (dry-run=$([ $APPLY = 0 ] && echo yes || echo NO)) ==="
echo "Will CLEAR (transcripts/history only):"
present=()
for t in "${TARGETS[@]}"; do
  if [ -e "$t" ]; then sz="$(du -sh "$t" 2>/dev/null | cut -f1)"; echo "  • $t  ($sz)"; present+=("$t"); fi
done
[ "${#present[@]}" -gt 0 ] || { echo "  (nothing found to clear)"; }
echo "Will PRESERVE (never touched):"
for p in "${PRESERVED[@]}"; do echo "  ✓ $p"; done

if [ "$APPLY" != "1" ]; then
  echo
  echo "Dry run only. To back up + delete:  bash scripts/clear-ai-sessions.sh --apply"
  exit 0
fi

[ "${#present[@]}" -gt 0 ] || { echo "Nothing to do."; exit 0; }

BK="$HOME/ai-session-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
echo
echo "▸ Archiving to $BK (restore point)…"
tar czf "$BK" "${present[@]}" 2>/dev/null || { echo "Backup failed — aborting, nothing deleted."; exit 1; }
echo "▸ Deleting cleared targets…"
for t in "${present[@]}"; do rm -rf "$t" && echo "  removed $t"; done

echo
echo "✓ Done. Backup: $BK  (delete it later once you're sure: rm \"$BK\")"
echo
echo "🔐 KEEP MUHAMMAD SAFE — the real protection is ROTATION:"
echo "   Any secret ever pasted into a chat should be rotated, since deleting the"
echo "   local transcript doesn't undo it was typed. Rotate now:"
echo "   • MEMORY_API_TOKEN  • CRON_SECRET  • QUO_WEBHOOK_SECRET"
echo "   • Supabase service_role key (if it was pasted)  • any API keys"
echo "   Then update ~/.hailmary/config.env + your app env with the new values."
