#!/usr/bin/env bash
# session-sweep-tonight.sh — catalog Cursor + Claude sessions → Brain digests (read before delete).
# NON-DESTRUCTIVE. Sources stay on disk. Outputs go to vault + BRAIN-FEED/inbox.
set -uo pipefail

TS="$(date +%Y%m%d)"
DIGEST_DIR="$HOME/Brain/vault/00-Dashboard/SESSION-DIGESTS-TONIGHT"
CATALOG="$DIGEST_DIR/SESSION-CATALOG-$TS.md"
INBOX="$HOME/Sync/rick/BRAIN-FEED/inbox"
mkdir -p "$DIGEST_DIR" "$INBOX"

say(){ printf '%s\n' "$*"; }

{
  echo "# SESSION CATALOG — $TS"
  echo "> Muhammad Taha · all tools · read before cleanup"
  echo "> Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Claude Code sessions"
  echo
} > "$CATALOG"

claude_n=0
if [[ -d "$HOME/.claude/projects" ]]; then
  find "$HOME/.claude/projects" -name '*.jsonl' -type f 2>/dev/null | sort | while read -r f; do
    claude_n=$((claude_n + 1))
    sz="$(wc -c < "$f" 2>/dev/null | tr -d ' ')"
    mt="$(stat -f '%Sm' -t '%Y-%m-%d' "$f" 2>/dev/null || date +%Y-%m-%d)"
    echo "- \`$f\` · ${sz} bytes · $mt"
  done >> "$CATALOG"
fi

{
  echo
  echo "## Cursor agent transcripts"
  echo
} >> "$CATALOG"

find "$HOME/.cursor/projects" -path '*/agent-transcripts/*.jsonl' -type f 2>/dev/null | sort | while read -r f; do
  sz="$(wc -c < "$f" 2>/dev/null | tr -d ' ')"
  mt="$(stat -f '%Sm' -t '%Y-%m-%d' "$f" 2>/dev/null || date +%Y-%m-%d)"
  echo "- \`$f\` · ${sz} bytes · $mt"
done >> "$CATALOG"

{
  echo
  echo "## Claude memory files"
  echo
} >> "$CATALOG"

find "$HOME/.claude/projects" -path '*/memory/*.md' -type f 2>/dev/null | sort | while read -r f; do
  echo "- \`$f\`"
done >> "$CATALOG"

# Recent session digests (last 14 days) — user-visible lines only, capped
RECENT_DAYS=14
cutoff="$(date -v-${RECENT_DAYS}d +%s 2>/dev/null || echo 0)"
digest_n=0

digest_one() {
  local f="$1" label="$2"
  local mtime; mtime="$(stat -f '%m' "$f" 2>/dev/null || echo 0)"
  [[ "$mtime" -lt "$cutoff" ]] && return 0
  digest_n=$((digest_n + 1))
  local out="$DIGEST_DIR/$(basename "$f" .jsonl)-digest.md"
  {
    echo "# Digest — $label"
    echo "source: \`$f\`"
    echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo "## Recent user messages (extract)"
    echo
  } > "$out"
  # Pull lines that look like user queries (best-effort on jsonl)
  grep -E '"type":"user"|"role":"user"' "$f" 2>/dev/null \
    | head -40 \
    | sed 's/^/- /' >> "$out" 2>/dev/null || echo "- (could not parse — see source)" >> "$out"
}

find "$HOME/.cursor/projects" -path '*/agent-transcripts/*.jsonl' -newermt "${RECENT_DAYS} days ago" -type f 2>/dev/null \
  | head -20 | while read -r f; do digest_one "$f" "cursor"; done

find "$HOME/.claude/projects" -name '*.jsonl' -newermt "${RECENT_DAYS} days ago" -type f 2>/dev/null \
  | head -20 | while read -r f; do digest_one "$f" "claude"; done

# Copy catalog to BRAIN-FEED inbox for M1 compile
cp -f "$CATALOG" "$INBOX/SESSION-CATALOG-$TS.md"

say "✓ Session catalog → $CATALOG"
say "✓ Digests → $DIGEST_DIR/"
say "✓ Copied to BRAIN-FEED/inbox for M1"
