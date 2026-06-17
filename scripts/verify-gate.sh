#!/usr/bin/env bash
# verify-gate — pre-push secret scan. Blocks pushes that contain secrets.
# Part of core.hookspath=.githooks (installed by swarm-join).
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RED=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; BD=$'\e[1m'; X=$'\e[0m'

PATTERNS=(
  'SUPABASE_SERVICE_ROLE_KEY\s*='
  'sk_live_'
  'sk_test_'
  'GHL_WEBHOOK_SECRET\s*='
  'STRIPE_SECRET'
  'AIRTABLE_PAT\s*='
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}'
  'private_key'
  'BEGIN RSA PRIVATE'
  'BEGIN OPENSSH PRIVATE'
)

# Only scan files staged for this push (not the whole tree)
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
[[ -z "$STAGED" ]] && STAGED=$(git diff HEAD~1 --name-only 2>/dev/null || true)
[[ -z "$STAGED" ]] && exit 0  # nothing staged, let it through

FOUND=0
for PAT in "${PATTERNS[@]}"; do
  HITS=$(echo "$STAGED" | xargs grep -lE "$PAT" 2>/dev/null | grep -v ".env" || true)
  if [[ -n "$HITS" ]]; then
    printf '%s  ✗ SECRET PATTERN FOUND: %s%s\n    in: %s\n' "$RED$BD" "$PAT" "$X" "$HITS"
    FOUND=1
  fi
done

if [[ $FOUND -eq 1 ]]; then
  printf '\n%s  ⛔ Push blocked. Remove secrets before pushing.%s\n' "$RED$BD" "$X"
  printf '  To bypass in a true emergency: git push --no-verify\n\n'
  exit 1
fi

printf '%s  ✓ verify-gate: no secrets detected%s\n' "$G" "$X"
exit 0
