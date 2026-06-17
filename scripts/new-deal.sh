#!/usr/bin/env bash
# new-deal — generate a client's paperwork in one command: engagement letter,
# remote-access consent, discovery intake, and a deposit invoice — filled with the
# total, the 50% deposit, and the balance. Saved locally (owner-only).
#   bash scripts/new-deal.sh "Client Name" 25000 "$25K — credit + funding + rentals" [monthly]
#   (word: deal)
# NOTE: templates are not legal advice — have counsel review before sending.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KIT="$ROOT/docs/deal-kit"
if [[ -t 1 ]]; then G=$'\e[32m'; C=$'\e[36m'; BD=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'; else G=; C=; BD=; D=; X=; fi

CLIENT="${1:-}"; TOTAL="${2:-}"; TIER="${3:-custom package}"; MONTHLY="${4:-—}"
if [ -z "$CLIENT" ] || [ -z "$TOTAL" ]; then
  printf '  usage: bash scripts/new-deal.sh "Client Name" <total$> "Tier label" [monthly$]\n'
  printf '  e.g.:  bash scripts/new-deal.sh "Ayyan Khan" 50000 "$50K — full stack"\n'; exit 1
fi
case "$TOTAL" in *[!0-9]*) echo "  ✗ total must be whole dollars, e.g. 25000"; exit 1;; esac

DEPOSIT=$(( TOTAL / 2 )); BALANCE=$(( TOTAL - DEPOSIT ))
commafy(){ local n="$1" o=""; while [ ${#n} -gt 3 ]; do o=",${n: -3}$o"; n=${n:0:${#n}-3}; done; printf '$%s%s' "$n" "$o"; }
T="$(commafy "$TOTAL")"; DP="$(commafy "$DEPOSIT")"; BL="$(commafy "$BALANCE")"
DATE="$(date +%Y-%m-%d)"
slug="$(printf '%s' "$CLIENT" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
OUT="$ROOT/.hailmary/deals/$slug"; mkdir -p "$OUT"

fill(){ # template_path -> stdout with placeholders replaced
  local c; c="$(cat "$1")"
  c="${c//\{\{CLIENT\}\}/$CLIENT}"; c="${c//\{\{DATE\}\}/$DATE}"; c="${c//\{\{TIER\}\}/$TIER}"
  c="${c//\{\{TOTAL\}\}/$T}"; c="${c//\{\{DEPOSIT\}\}/$DP}"; c="${c//\{\{BALANCE\}\}/$BL}"
  c="${c//\{\{MONTHLY\}\}/$MONTHLY}"; c="${c//\{\{DISCOVERY_DAYS\}\}/5}"
  c="${c//\{\{LIABILITY_MONTHS\}\}/3}"; c="${c//\{\{DASHBOARDS\}\}/(list at signing)}"
  c="${c//\{\{SCOPE\}\}/Per the **$TIER** package in docs/OFFER-STACK.md — setup, build, and the support included at this tier. Detailed line items attached.}"
  printf '%s\n' "$c"
}

fill "$KIT/ENGAGEMENT-LETTER.md"     > "$OUT/engagement-letter.md"
fill "$KIT/REMOTE-ACCESS-CONSENT.md" > "$OUT/remote-access-consent.md"
fill "$KIT/DISCOVERY-INTAKE.md"      > "$OUT/discovery-intake.md"

cat > "$OUT/invoice-deposit.md" <<EOF
# DEPOSIT INVOICE — $CLIENT

**Date:** $DATE
**Bill to:** $CLIENT
**Package:** $TIER

| Item | Amount |
|---|---|
| Project total | $T |
| **Deposit due now (50%)** | **$DP** |
| Balance (later) | $BL |
| Monthly support | $MONTHLY |

**Pay the deposit to start.** Work begins when the deposit clears.
Payment method: ____________________   Due: on receipt.

_Not a tax/legal document — adapt to your invoicing + have counsel review terms._
EOF

printf '\n  %s%s✓ DEAL PACK READY%s — %s · total %s · deposit %s\n' "$G" "$BD" "$X" "$CLIENT" "$T" "$DP"
printf '  %ssaved (owner-local):%s %s\n' "$D" "$X" "${OUT#"$ROOT"/}/"
printf '     • engagement-letter.md\n     • remote-access-consent.md\n     • discovery-intake.md\n     • invoice-deposit.md\n'
printf '  %snext: review with counsel → send → on 50%% deposit, discovery starts.%s\n\n' "$D" "$X"
