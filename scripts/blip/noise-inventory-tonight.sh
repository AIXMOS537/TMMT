#!/usr/bin/env bash
# noise-inventory-tonight.sh — list clutter candidates. NEVER deletes. Fable/owner approves first.
set -uo pipefail

TS="$(date +%Y%m%d)"
OUT="$HOME/Brain/vault/98-Cold-Storage/TRASH-STAGING-MANIFEST-$TS.md"
mkdir -p "$(dirname "$OUT")"

{
  echo "# TRASH STAGING MANIFEST — $TS"
  echo "> DO NOT DELETE until Fable 5 + Muhammad Taha approve."
  echo "> Everything listed here was cataloged AFTER session sweep + brain compile."
  echo "> Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Rule"
  echo "1. Brain compiled → M1 has copy"
  echo "2. This manifest reviewed"
  echo "3. Only then: move to trash (never rm -rf blind)"
  echo
  echo "## Large folders (review)"
  echo
} > "$OUT"

for d in \
  "$HOME/Downloads" \
  "$HOME/Desktop" \
  "$HOME/Brain/vault/99-Inbox" \
  "$HOME/.cursor/projects" \
  "$HOME/.Trash"; do
  [[ -d "$d" ]] || continue
  du -sh "$d" 2>/dev/null | awk -v p="$d" '{print "- `" p "` — " $1}'
done >> "$OUT" 2>/dev/null

{
  echo
  echo "## Duplicate / stale BLIP folders on Desktop (review)"
  echo
} >> "$OUT"

find "$HOME/Desktop" -maxdepth 1 -type d \( -iname '*BLIP*' -o -iname '*FOREVER*' -o -iname '*HANDOFF*' \) 2>/dev/null \
  | while read -r d; do du -sh "$d" 2>/dev/null | awk -v p="$d" '{print "- `" p "` — " $1}'; done >> "$OUT"

{
  echo
  echo "## Claude worktrees (merge or archive after review)"
  echo
} >> "$OUT"

[[ -d "$HOME/Brain/vault/.claude/worktrees" ]] && \
  find "$HOME/Brain/vault/.claude/worktrees" -maxdepth 1 -mindepth 1 -type d 2>/dev/null \
    | while read -r d; do echo "- \`$d\`"; done >> "$OUT"

{
  echo
  echo "## node_modules on Desktop/Downloads (safe to delete after confirm)"
  echo
} >> "$OUT"

find "$HOME/Desktop" "$HOME/Downloads" -name node_modules -type d -maxdepth 4 2>/dev/null \
  | head -20 | while read -r d; do du -sh "$d" 2>/dev/null | awk -v p="$d" '{print "- `" p "` — " $1}'; done >> "$OUT"

cp -f "$OUT" "$HOME/Sync/rick/BRAIN-FEED/inbox/TRASH-STAGING-MANIFEST-$TS.md"
printf '✓ Noise manifest (no deletes) → %s\n' "$OUT"
