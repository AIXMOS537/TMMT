#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# deal.sh — the money ledger. Every dollar, every deal, one place. Answers
# WHO · WHAT · WHEN · WHERE · WHY · HOW MUCH · YOUR CUT — and enforces the law:
#
#            💵 PAID UPFRONT. No pay, no work. From now on, forever.
#
# A deal isn't GO until it's collected. Anything unpaid sits on HOLD and the work
# does not start. The owner's cut is computed on every deal.
# ───────────────────────────────────────────────────────────────────────────
#   bash scripts/deal.sh add --who "Name" --what "Service" --where tmmt \
#        --why "deal note" --amount 5000 --cut 50% [--paid]
#   bash scripts/deal.sh paid <id>      # mark a HOLD deal as collected (releases work)
#   bash scripts/deal.sh list           # every deal
#   bash scripts/deal.sh hold           # unpaid deals — DO NOT START these
#   bash scripts/deal.sh summary        # totals: collected · your cut · by business
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
B(){ printf "\033[1m%s\033[0m\n" "$1"; }
G(){ printf "\033[42;30m %s \033[0m\n" "$1"; }
R(){ printf "\033[41;97m %s \033[0m\n" "$1"; }
Y(){ printf "\033[43;30m %s \033[0m\n" "$1"; }
dim(){ printf "\033[2m%s\033[0m\n" "$1"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LD="$ROOT/.aixmos/ledger"; TSV="$LD/deals.tsv"; mkdir -p "$LD"
# columns: id date who where what why amount cut paid paid_at kind
[ -f "$TSV" ] || printf 'id\tdate\twho\twhere\twhat\twhy\tamount\tcut\tpaid\tpaid_at\tkind\n' > "$TSV"

money(){ printf '$%s' "$(printf '%.2f' "${1:-0}" 2>/dev/null || echo 0)"; }
calc_cut(){ # $1 amount, $2 cut (e.g. 50% or 2500) -> cut amount
  local amt="$1" c="$2"
  case "$c" in
    *%) awk -v a="$amt" -v p="${c%\%}" 'BEGIN{printf "%.2f", a*p/100}';;
    "") printf '%.2f' "$amt";;                # default: 100% is yours
    *)  printf '%.2f' "$c";;
  esac
}
calc_partner(){ # $1 net amount, $2 base (your cost-recovery), $3 split% -> YOUR cut
  # PROTECTIVE: your base comes off the TOP first (you never bleed on the car),
  # then split% of whatever's left. If net < base, you take ALL of it; partner $0.
  awk -v a="$1" -v b="$2" -v s="${3:-50}" 'BEGIN{
    if (a<=b) { printf "%.2f", a }                 # you recover first, partner gets nothing
    else      { printf "%.2f", b + (a-b)*s/100 }   # base + your split of the upside
  }'
}
refresh_number(){ # write the running number into the CEO brief's THE NUMBER
  awk -F'\t' 'NR>1 && $9=="yes"{c+=$7; k+=$8} END{
    printf "Collected (upfront): $%.2f  ·  your cut: $%.2f  ·  paid deals: logged\n", c+0, k+0
  }' "$TSV" > "$ROOT/.aixmos/revenue.txt" 2>/dev/null || true
}

CMD="${1:-list}"; shift || true
case "$CMD" in
  add)
    WHO=""; WHAT=""; WHERE=""; WHY=""; AMOUNT=""; CUT=""; PAID="no"; PAID_AT="-"; BASE=""; SPLIT="50"; KIND=""
    while [ $# -gt 0 ]; do case "$1" in
      --who) WHO="${2:-}"; shift 2;;
      --what) WHAT="${2:-}"; shift 2;;
      --where) WHERE="${2:-}"; shift 2;;
      --why) WHY="${2:-}"; shift 2;;
      --amount) AMOUNT="${2:-}"; shift 2;;
      --cut) CUT="${2:-}"; shift 2;;
      --base) BASE="${2:-}"; shift 2;;        # partnership: your cost-recovery off the top
      --split) SPLIT="${2:-50}"; shift 2;;    # partnership: your % of the upside (def 50)
      --type) KIND="${2:-}"; shift 2;;        # owned | operator (else inferred)
      --paid) PAID="yes"; PAID_AT="$(date -u +%FT%TZ)"; shift;;
      *) shift;; esac; done
    [ -n "$WHO" ] && [ -n "$AMOUNT" ] || { echo 'need at least --who and --amount'; exit 2; }
    # owned = your own car/business (100% yours) · operator = a partner split (base set)
    [ -n "$KIND" ] || { [ -n "$BASE" ] && KIND="operator" || KIND="owned"; }
    WHERE="${WHERE:-tmmt}"; WHAT="${WHAT:-service}"; WHY="${WHY:--}"
    if [ -n "$BASE" ]; then
      CUTAMT="$(calc_partner "$AMOUNT" "$BASE" "$SPLIT")"
      WHY="${WHY} [partner: 1 car · \$${BASE} recovery + ${SPLIT}% upside]"
    else
      CUTAMT="$(calc_cut "$AMOUNT" "$CUT")"
    fi
    # guaranteed-unique, monotonic id (never collides, even within the same second)
    SEQ="$LD/seq"; n=$(( $(cat "$SEQ" 2>/dev/null || echo 1000) + 1 )); echo "$n" > "$SEQ"; ID="$n"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$ID" "$(date +%F)" "$WHO" "$WHERE" "$WHAT" "$WHY" "$AMOUNT" "$CUTAMT" "$PAID" "$PAID_AT" "$KIND" >> "$TSV"
    refresh_number
    echo
    B "════════════ DEAL #$ID ════════════"
    echo "  WHO    : $WHO"
    echo "  WHAT   : $WHAT"
    echo "  WHEN   : $(date +%F)"
    echo "  WHERE  : $WHERE"
    echo "  WHY    : $WHY"
    echo "  AMOUNT : $(money "$AMOUNT")"
    if [ -n "$BASE" ]; then
      PARTNER_SHARE="$(awk -v a="$AMOUNT" -v c="$CUTAMT" 'BEGIN{printf "%.2f", a-c}')"
      echo "  YOUR \$ : $(money "$CUTAMT")  ← $(money "$BASE") recovery first, then ${SPLIT}% of the rest"
      echo "  THEIRS : $(money "$PARTNER_SHARE")  (only after you're made whole)"
    else
      echo "  YOUR \$ : $(money "$CUTAMT")  ${CUT:+($CUT)}"
    fi
    echo
    if [ "$PAID" = yes ]; then G "💵 PAID UPFRONT — collected. Work is GO."
    else R "⛔ UNPAID — HOLD. Do NOT start work until collected."; dim "   collect, then: bash scripts/deal.sh paid $ID"; fi
    ;;
  paid)
    ID="${1:-}"; [ -n "$ID" ] || { echo "usage: deal.sh paid <id>"; exit 2; }
    grep -q "^$ID	" "$TSV" || { echo "no deal #$ID"; exit 1; }
    awk -F'\t' -v id="$ID" -v now="$(date -u +%FT%TZ)" 'BEGIN{OFS="\t"}
      NR==1{print;next} $1==id{$9="yes"; $10=now} {print}' "$TSV" > "$TSV.tmp" && mv "$TSV.tmp" "$TSV"
    refresh_number
    G "💵 #$ID marked PAID UPFRONT — work is GO."
    ;;
  hold)
    B "⛔ UNPAID — DO NOT START THESE (no pay, no work):"
    n=$(awk -F'\t' 'NR>1 && $9!="yes"' "$TSV" | grep -c . || true)
    [ "${n:-0}" -gt 0 ] || { dim "  (none — everything on the books is paid upfront. clean.)"; exit 0; }
    awk -F'\t' 'NR>1 && $9!="yes"{printf "  #%s  %s  %s  $%s  — %s\n",$1,$3,$4,$7,$5}' "$TSV"
    ;;
  summary)
    B "💰 LEDGER SUMMARY"
    awk -F'\t' 'NR>1{
      kind=($11==""?"owned":$11)
      total+=$7; if($9=="yes"){coll+=$7; cut+=$8; pd++} else {hold+=$7; hd++}
      biz[$4]+=$7; bizc[$4]+=($9=="yes"?$8:0)
      if($9=="yes"){ kcut[kind]+=$8; kcoll[kind]+=$7; kn[kind]++ }
    } END{
      printf "  collected upfront : $%.2f  (%d deals)\n", coll+0, pd+0
      printf "  YOUR CUT (paid)   : $%.2f\n", cut+0
      printf "  on HOLD (unpaid)  : $%.2f  (%d deals)  ← chase or kill\n", hold+0, hd+0
      printf "  booked total      : $%.2f\n", total+0
      print  "  ── owned vs operator (your cut, paid) ──"
      ow=kcut["owned"]+0; op=kcut["operator"]+0; tt=ow+op
      printf "    🚗 owned (your cars/biz) : $%.2f", ow
      if(tt>0) printf "  (%d%% of your income)", int(ow*100/tt+0.5); printf "\n"
      printf "    🤝 operator (partners)   : $%.2f", op
      if(tt>0) printf "  (%d%% of your income)", int(op*100/tt+0.5); printf "\n"
      if(tt>0 && op>=ow) print  "    → the model has shifted: partners now carry your income. asset-light. 👑"
      else if(tt>0)      print  "    → still owned-heavy. each new licensed partner shifts this your way."
      print  "  ── by business ──"
      for(b in biz) printf "    %-14s booked $%.2f · your cut $%.2f\n", b, biz[b], bizc[b]
    }' "$TSV"
    ;;
  list|"")
    B "📒 DEALS — who · what · when · where · why · amount · your cut · paid"
    awk -F'\t' 'NR==1{next} {
      paid=($9=="yes")?"💵PAID":"⛔HOLD"
      printf "  #%-6s %s  %-14s %-10s %-16s $%-9s cut $%-9s %s\n", $1,$2,$3,$4,$5,$7,$8,paid
    }' "$TSV"
    awk -F'\t' 'END{if(NR<=1)print "  (no deals yet — log one: deal.sh add --who ... --amount ... --cut 50% --paid)"}' "$TSV"
    ;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) echo "usage: deal.sh {add|paid <id>|list|hold|summary}";;
esac
