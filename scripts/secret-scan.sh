#!/usr/bin/env bash
#
# secret-scan.sh — inventory likely secrets in a repo before rotating/scrubbing.
# Read-only. Redacts values by default. Run on any repo/machine on the mesh.
# ---------------------------------------------------------------------------
#   scripts/secret-scan.sh                 # scan current tracked files (redacted)
#   scripts/secret-scan.sh --history       # also scan FULL git history (all branches)
#   scripts/secret-scan.sh --raw           # show full values (LOCAL triage only!)
#
# Exit 0 = current tree clean. Exit 1 = secret(s) in current tree (gate-friendly).
# Report: .aixmos/secret-scan-report.txt
# ---------------------------------------------------------------------------
set -uo pipefail
HISTORY=false; RAW=false
for a in "$@"; do case "$a" in
  --history) HISTORY=true;; --raw) RAW=true;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) echo "unknown arg: $a"; exit 2;;
esac; done

command -v git >/dev/null || { echo "git required"; exit 2; }
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
mkdir -p .aixmos; REPORT=".aixmos/secret-scan-report.txt"

# name|regex  — high-signal credential patterns
PATTERNS=(
  "airtable-pat|pat[A-Za-z0-9]{14}\.[A-Za-z0-9]{64}"
  "anthropic-key|sk-ant-[A-Za-z0-9_-]{20,}"
  "openai-key|sk-[A-Za-z0-9]{32,}"
  "stripe-secret|sk_live_[A-Za-z0-9]{16,}"
  "stripe-restricted|rk_live_[A-Za-z0-9]{16,}"
  "aws-access-key|AKIA[0-9A-Z]{16}"
  "google-api-key|AIza[0-9A-Za-z_-]{35}"
  "github-token|gh[pousr]_[A-Za-z0-9]{36,}"
  "slack-token|xox[baprs]-[A-Za-z0-9-]{10,}"
  "tailscale-key|tskey-[A-Za-z0-9-]{10,}"
  "telegram-bot|[0-9]{8,10}:[A-Za-z0-9_-]{35}"
  "jwt|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}"
  "private-key-block|-----BEGIN [A-Z ]*PRIVATE KEY-----"
  "generic-secret|(SECRET|TOKEN|API_?KEY|PASSWORD|PASSWD|ACCESS_?KEY)[\"' ]*[:=][\"' ]*[A-Za-z0-9._-]{20,}"
)
redact(){ if $RAW; then cat; else sed -E 's/([A-Za-z0-9]{6})[A-Za-z0-9._/+-]{8,}/\1…REDACTED/g'; fi; }
EXCL='package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.gitleaksignore|node_modules/|\.min\.|secret-scan\.sh'
# Env references (process.env.X / import.meta.env.X / Deno.env.get) are NOT literal
# secrets — skip them so the generic pattern doesn't flag every config read.
ENV_REF='[:=][>"'"'"'` ]*(await +)?(process\.env|import\.meta\.env|Deno\.env)'

found=0
{
  echo "# secret-scan — $(date -u +%Y-%m-%dT%H:%M:%SZ)  repo=$(basename "$PWD")"
  $RAW && echo "!! RAW MODE — values shown. Local triage only; never share this file."
  echo
  echo "## A) Current tracked files"
} | tee "$REPORT"

for entry in "${PATTERNS[@]}"; do
  name="${entry%%|*}"; re="${entry#*|}"
  hits="$(git ls-files | grep -vE "$EXCL" | while read -r f; do grep -EnHI "$re" "$f" 2>/dev/null; done)"
  [ "$name" = "generic-secret" ] && [ -n "$hits" ] && hits="$(echo "$hits" | grep -vE "$ENV_REF" || true)"
  if [ -n "$hits" ]; then
    found=$((found+1))
    { echo "### [$name]"; echo "$hits" | redact; } | tee -a "$REPORT"
  fi
done
[ "$found" -eq 0 ] && echo "✓ current tree clean (no patterns matched)" | tee -a "$REPORT"

if $HISTORY; then
  { echo; echo "## B) Git history (all branches — added/removed lines)"; } | tee -a "$REPORT"
  for entry in "${PATTERNS[@]}"; do
    name="${entry%%|*}"; re="${entry#*|}"
    h="$(git log --all -p --no-color 2>/dev/null | grep -EI "^[+-].*($re)" | sort -u)"
    [ -n "$h" ] && { echo "### [$name]"; echo "$h" | redact | head -20; } | tee -a "$REPORT"
  done
  echo "(history scan complete — purge with git filter-repo; see docs/SECRET-ROTATION.md)" | tee -a "$REPORT"
fi

echo | tee -a "$REPORT"
echo "Report: $REPORT" | tee -a "$REPORT"
[ "$found" -eq 0 ] && exit 0 || { echo "✗ $found secret type(s) in current tree — scrub + rotate."; exit 1; }
