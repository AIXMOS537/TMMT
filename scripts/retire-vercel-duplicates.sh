#!/usr/bin/env bash
# Retire duplicate Vercel projects for AIXMOS537/TMMT.
# Keep ONE project: tmmt-c919 (then rename → tmmt-command-center for the operator URL).
#
# Prereq: vercel login && cd repo root
# Usage: bash scripts/retire-vercel-duplicates.sh [--apply]

set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

CANONICAL_PROJECT="tmmt-c919"
CANONICAL_PROJECT_ID="prj_moZzMHYtwiZIS0TETOBOKODbp7eM"
DUPLICATES=(tmmt tmmt-ops tmmt-command-center aixmos-landing)
TARGET_ALIAS="tmmt-command-center.vercel.app"

run() {
  if $APPLY; then
    echo ">> $*"
    "$@"
  else
    echo "DRY-RUN: $*"
  fi
}

echo "=== TMMT Vercel duplicate retirement ==="
echo "Canonical project: $CANONICAL_PROJECT ($CANONICAL_PROJECT_ID)"
echo "Duplicates to remove: ${DUPLICATES[*]}"
echo ""

if ! $APPLY; then
  echo "Dry run only. Re-run with: bash scripts/retire-vercel-duplicates.sh --apply"
  echo ""
fi

echo "--- Step 1: Confirm canonical project builds ---"
run vercel project ls 2>/dev/null | grep -E "tmmt|aixmos" || true

echo ""
echo "--- Step 2: Move operator alias BEFORE deleting tmmt-command-center ---"
echo "In Vercel dashboard → $CANONICAL_PROJECT → Settings → General → Project Name"
echo "  Rename '$CANONICAL_PROJECT' → 'tmmt-command-center'"
echo "  (Frees the name and gives you $TARGET_ALIAS on the good deployment.)"
echo "  OR: Settings → Domains → verify production deploy is latest on master"
echo ""

echo "--- Step 3: Disconnect GitHub from duplicate projects ---"
for p in "${DUPLICATES[@]}"; do
  echo "Project: $p → Settings → Git → Disconnect (or delete project below)"
done

echo ""
echo "--- Step 4: Delete duplicate projects ---"
for p in "${DUPLICATES[@]}"; do
  if [[ "$p" == "tmmt-command-center" ]]; then
    echo "SKIP CLI delete for tmmt-command-center until $CANONICAL_PROJECT is renamed (Step 2)."
    echo "  Then: vercel project rm tmmt-command-center --yes   # removes the OLD empty shell"
    continue
  fi
  run vercel project rm "$p" --yes
done

echo ""
echo "--- Step 5: Verify ---"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://$TARGET_ALIAS/forms/customer-intake   # expect 200"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://$TARGET_ALIAS/login               # expect 200"
echo "  npm run smoke:prod"
echo ""
echo "Done."
