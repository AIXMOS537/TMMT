#!/usr/bin/env bash
#
# account-hardening.sh — guided, LOCAL, one-by-one credential hardening tracker.
# ---------------------------------------------------------------------------
# It NEVER stores a password and NEVER logs into anything. It is a checklist +
# progress tracker, in the safe order, so YOU harden every account one at a time.
# The actual resets are done by you, in your browser, with your password manager.
#
#   scripts/account-hardening.sh init          # create your inventory from the template
#   scripts/account-hardening.sh status        # progress board
#   scripts/account-hardening.sh next          # the next account to do + its checklist
#   scripts/account-hardening.sh done "NAME"   # mark that account hardened (pw+vault+mfa)
#
# Your inventory lives at .aixmos/security/inventory.tsv (gitignored). Edit it to add
# your real accounts (names/urls only — NO passwords).
# ---------------------------------------------------------------------------
set -uo pipefail
bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
warn(){ printf "\033[33m!\033[0m %s\n" "$1"; }
die(){ printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DIR="$ROOT/.aixmos/security"; INV="$DIR/inventory.tsv"
TPL="$ROOT/config/account-inventory.example.tsv"
mkdir -p "$DIR"
CMD="${1:-status}"; shift || true

fully(){ # args: pw vault mfa  -> "yes" if hardened
  local pw="$1" v="$2" m="$3"
  [ "$pw" = yes ] && { [ "$v" = yes ] || [ "$v" = n/a ]; } && [ "$m" = yes ] && echo yes || echo no
}

checklist(){ cat <<'C'
   ┌─ harden this account ─────────────────────────────────────┐
   │ 1. Reset to a NEW, UNIQUE, long password (let the vault    │
   │    generate it). Never reuse a password across accounts.   │
   │ 2. Save it in your password manager (Dashlane/iCloud/etc). │
   │ 3. Turn on MFA — prefer an authenticator app or a passkey/ │
   │    hardware key (YubiKey). Avoid SMS where you can.        │
   │ 4. Review recovery options + remove old/unknown connected  │
   │    apps + sign out all other sessions.                     │
   │ 5. Mark done:  account-hardening.sh done "<name>"          │
   └────────────────────────────────────────────────────────────┘
   Reminder: do this in YOUR browser. Never paste a password into an agent.
C
}

case "$CMD" in
  init)
    [ -f "$TPL" ] || die "template missing: $TPL"
    if [ -f "$INV" ]; then warn "inventory already exists: $INV (not overwritten)"; else cp "$TPL" "$INV"; ok "created $INV — edit it to add your real accounts (names/urls only)."; fi
    ;;
  top)
    [ -f "$INV" ] || die "no inventory yet — run: account-hardening.sh init"
    bold "== CROWN JEWELS — harden these first (ignore the other ~370) =="
    awk -F'\t' 'NR==1{next} /^#/||NF<7{next}
      { lc=tolower($3);
        if ($1+0<=6 || $2=="bank" || $2=="payments" ||
            lc ~ /credit|score|equifax|experian|transunion|identityiq|idiq|wallethub|navyfederal|smartcredit|t-mobile|verizon|xfinity|openphone|instagram|facebook|tiktok|linkedin|snapchat|discord|reddit|twitch|youtube/) {
          h=($5=="yes" && ($6=="yes"||$6=="n/a") && $7=="yes")?"\033[32m✔\033[0m":"\033[31m·\033[0m";
          printf "  %s  P%s  %-30s\n", h, $1, $3; n++ } }
      END{ printf "\n  %d accounts that actually protect you + your family. Do these. Skip the rest for now.\n", n }' "$INV"
    ;;
  status|list)
    [ -f "$INV" ] || die "no inventory yet — run: account-hardening.sh init"
    bold "== account hardening — progress =="
    awk -F'\t' 'BEGIN{done=0;tot=0}
      /^#/||NF<7{next}
      { tot++; h=($5=="yes" && ($6=="yes"||$6=="n/a") && $7=="yes")?1:0; done+=h;
        mark=h?"\033[32m✔\033[0m":"\033[31m·\033[0m";
        printf "  %s  P%s  %-34s pw:%-3s vault:%-4s mfa:%-3s\n", mark, $1, $3, $5, $6, $7 }
      END{ printf "\n  %d / %d accounts fully hardened\n", done, tot }' "$INV"
    ;;
  next)
    [ -f "$INV" ] || die "no inventory yet — run: account-hardening.sh init"
    row="$(awk -F'\t' '!/^#/&&NF>=7{ if(!($5=="yes" && ($6=="yes"||$6=="n/a") && $7=="yes")){print; exit} }' "$INV")"
    [ -n "$row" ] || { ok "Every account is hardened. 🔒 You did it — one at a time."; exit 0; }
    IFS=$'\t' read -r pri cat name url pw vault mfa notes <<<"$row"
    bold "▶ NEXT (priority $pri · $cat):  $name"
    [ "$url" != "-" ] && echo "   open: $url"
    [ -n "${notes:-}" ] && echo "   note: $notes"
    echo; checklist
    ;;
  done|mark)
    [ -f "$INV" ] || die "no inventory yet — run: account-hardening.sh init"
    NAME="${1:-}"; [ -n "$NAME" ] || die 'usage: account-hardening.sh done "Account Name"'
    awk -F'\t' -v n="$NAME" 'BEGIN{OFS="\t"; hit=0}
      /^#/{print;next}
      NF>=7 && index(tolower($3),tolower(n))>0 { $5="yes"; if($6!="n/a")$6="yes"; $7="yes"; hit=1 }
      {print}
      END{ if(!hit) exit 3 }' "$INV" > "$INV.tmp" && mv "$INV.tmp" "$INV" \
      && ok "marked hardened: $NAME" || { rm -f "$INV.tmp"; die "no account matching: $NAME"; }
    ;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) die "unknown: $CMD (try: init | status | next | done)";;
esac
