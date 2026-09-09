#!/usr/bin/env bash
# Retire the legacy Vercel projects for AIXMOS537/TMMT. ONE app remains.
#
# KEEP:   tmmt-ops  → the one app: ops, owner command center, training, forms
# PUBLIC: allinonemanagementsolutions.com → GHL site (not on Vercel at all)
#
# RETIRE (each deployed the same repo; every push created a BLOCKED deploy):
#   tmmt-command-center  (May prototype; tree preserved at tag archive/command-center-2026-05-18)
#   tmmt-training-site   (never had a production deploy; academy = /learn in tmmt-ops)
#   aixmos-offer         (never had a production deploy)
#
# NOT RETIRED — aixmos-landing. Owner decision 2026-09-09: it stays SERVING at
# aixmos-landing.vercel.app, as-is. It was in this list until then, which meant
# one --apply run would have irreversibly deleted a site the owner had just
# decided to keep. Do not add it back without a new owner decision.
#
# All three above are already PAUSED (503 DEPLOYMENT_PAUSED), which is the
# reversible form of the same outcome. Running this script is therefore
# OPTIONAL — it only frees the names. Pausing is undone with one call;
# deleting is not undone at all.
#
# Harvest of env vars, settings, domains and deployed source was completed
# 2026-09-03 → ~/Archive/vercel-harvest-20260903/ (see docs/THREE-APP-ECOSYSTEM.md).
# That folder lives on the M1, NOT on Carry — see the pre-flight check below.
#
# Usage: bash scripts/retire-vercel-duplicates.sh            # dry run
#        bash scripts/retire-vercel-duplicates.sh --apply    # OWNER ONLY — deletes projects
set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true
SCOPE="${VERCEL_SCOPE:-aixmos537}"

RETIRE=(tmmt-command-center tmmt-training-site aixmos-offer)
KEEP=tmmt-ops

run() { if $APPLY; then echo ">> $*"; "$@"; else echo "DRY-RUN: $*"; fi; }

echo "=== Retire legacy Vercel projects — ONE app remains ==="
echo "  ✓ keep   $KEEP"
for p in "${RETIRE[@]}"; do echo "  ✗ retire $p"; done
echo

echo "--- Pre-flight: the one app must be healthy before anything is deleted ---"
for u in https://tmmt-ops.vercel.app/login https://tmmt-ops.vercel.app/forms/customer-intake https://tmmt-ops.vercel.app/api/health; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$u" || echo ERR)
  echo "  $u → $code"
  [[ "$code" == "200" ]] || { echo "ABORT: $u is not 200"; exit 1; }
done
if [ -d "$HOME/Archive/vercel-harvest-20260903" ]; then
  echo "  harvest present: ~/Archive/vercel-harvest-20260903"
elif $APPLY; then
  # Deletion is irreversible and these projects have no git link, so the harvest
  # is the only copy of what they served. A missing harvest used to be a WARN
  # that --apply sailed straight past.
  echo "ABORT: ~/Archive/vercel-harvest-20260903 is missing on this machine."
  echo "       It lives on the M1. Copy it here, or run --apply there."
  exit 1
else
  echo "  NOTE: harvest folder missing on this machine (it lives on the M1)."
  echo "        --apply will refuse to run until it is present."
fi
echo

if ! $APPLY; then
  echo "Dry run. Deleting projects is irreversible — owner re-runs with: bash scripts/retire-vercel-duplicates.sh --apply"
  echo
fi

for p in "${RETIRE[@]}"; do
  run vercel project rm "$p" --yes --scope "$SCOPE"
done

echo
echo "--- Left alone on purpose ---"
echo "  aixmos-landing → still SERVING (owner decision 2026-09-09). Not deleted."
echo
echo "--- After: optional vanity alias for the academy ---"
echo "  vercel domains add tmmt-academy.vercel.app $KEEP --scope $SCOPE   # freed once tmmt-training-site is gone"
