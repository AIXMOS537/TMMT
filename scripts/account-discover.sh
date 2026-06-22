#!/usr/bin/env bash
#
# account-discover.sh — build your account inventory FAST from your browsers.
# ---------------------------------------------------------------------------
# Reads the LIST of sites you have saved logins for (site + username only).
# It NEVER reads, decrypts, or stores a password — it only selects origin_url
# and username so you get a complete list of accounts to harden. Local output.
#
#   scripts/account-discover.sh             # discover (this user's Chrome/Opera/Brave/Edge/Arc/FF)
#   scripts/account-discover.sh --merge     # also append new finds into inventory.tsv
#   scripts/account-discover.sh --all-users # scan every /Users profile (run with admin)
#
# Pairs with scripts/account-hardening.sh. macOS + Chromium browsers (Chrome/Brave/
# Edge/Arc) + Firefox hostnames. Safari/Keychain passwords are NOT read (by design).
# ---------------------------------------------------------------------------
set -uo pipefail
bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
warn(){ printf "\033[33m!\033[0m %s\n" "$1"; }

MERGE=false; ALL_USERS=false
for a in "$@"; do case "$a" in --merge) MERGE=true;; --all-users) ALL_USERS=true;; esac; done
command -v sqlite3 >/dev/null || { warn "sqlite3 not found (macOS ships it; install if missing)"; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DIR="$ROOT/.aixmos/security"; OUT="$DIR/discovered.tsv"; INV="$DIR/inventory.tsv"
mkdir -p "$DIR"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

domain(){ # url -> registrable-ish domain (last two labels)
  printf '%s\n' "$1" | sed -E 's#^[a-z]+://##; s#/.*$##; s#:.*$##' | awk -F. '{ if (NF>=2) print $(NF-1)"."$NF; else print $0 }'
}
classify(){ local d="$1"
  case "$d" in
    *chase*|*bankofamerica*|*bofa*|*wellsfargo*|*citi*|*capitalone*|*usbank*|*pnc*|*ally*|*amex*|*americanexpress*) echo "bank";;
    *paypal*|*stripe*|*venmo*|*cashapp*|*wise*|*coinbase*) echo "payments";;
    *instagram*|*facebook*|*tiktok*|*twitter*|*x.com*|*linkedin*|*snapchat*|*youtube*|*reddit*) echo "social";;
    *github*|*vercel*|*supabase*|*airtable*|*cloudflare*|*gohighlevel*|*godaddy*|*namecheap*) echo "infra";;
    *google*|*apple*|*microsoft*|*icloud*) echo "identity";;
    *) echo "account";;
  esac
}

# Chromium-family browsers (each recurses into ALL profiles automatically).
# Includes Opera / Opera GX / Opera Air (the AI browser) — all Chromium under the hood.
CHROMIUM_BASES=(
  "Google/Chrome" "BraveSoftware/Brave-Browser" "Microsoft Edge" "Arc/User Data"
  "Vivaldi" "Chromium"
  "com.operasoftware.Opera" "com.operasoftware.OperaGX" "com.operasoftware.OperaAir" "com.operasoftware.OperaNext"
)
homes(){ if $ALL_USERS; then ls -d /Users/* 2>/dev/null; else printf '%s\n' "$HOME"; fi; }

i=0
scan_all(){
  while IFS= read -r home; do
    local lib="$home/Library/Application Support"
    [ -d "$lib" ] || continue
    for base in "${CHROMIUM_BASES[@]}"; do
      while IFS= read -r db; do
        [ -n "$db" ] || continue
        cp "$db" "$TMP/ld$i.sqlite" 2>/dev/null || continue
        # NOTE: password_value is deliberately NOT selected — only site + username.
        sqlite3 -separator $'\t' "$TMP/ld$i.sqlite" "SELECT DISTINCT origin_url, username_value FROM logins;" 2>/dev/null
        i=$((i+1))
      done < <(find "$lib/$base" -name "Login Data" 2>/dev/null)
    done
    # Firefox: hostnames only (passwords stay encrypted/untouched)
    while IFS= read -r j; do
      grep -oE '"hostname":"[^"]+"' "$j" 2>/dev/null | sed 's/"hostname":"//; s/"$//'
    done < <(find "$home/Library/Application Support/Firefox/Profiles" -name logins.json 2>/dev/null)
  done < <(homes)
}

bold "== account-discover (reads site lists only — NEVER passwords) =="
$ALL_USERS && warn "scanning ALL macOS users under /Users (needs admin to read others)" || echo "  scope: this macOS user (all its Chrome/Opera/Brave/Edge/Arc profiles + Firefox)"
scan_all > "$TMP/raw" 2>/dev/null || true
# build deduped domain -> first username seen
: > "$OUT.body"
awk -F'\t' '{print $1"\t"$2}' "$TMP/raw" | while IFS=$'\t' read -r url user; do
  [ -n "$url" ] || continue
  d="$(domain "$url")"; [ -n "$d" ] || continue
  printf '%s\t%s\n' "$d" "$user"
done | sort -u | awk -F'\t' '!seen[$1]++{print $1"\t"$2}' > "$TMP/byd"

count=0
printf '# priority\tcategory\tname\turl\tpw_reset\tin_vault\tmfa\tnotes\n' > "$OUT"
while IFS=$'\t' read -r d user; do
  [ -n "$d" ] || continue
  cat="$(classify "$d")"
  case "$cat" in bank|payments) pri=4;; identity) pri=2;; infra) pri=6;; social) pri=7;; *) pri=7;; esac
  printf '%s\t%s\t%s\thttps://%s\tno\tno\tno\t%s\n' "$pri" "$cat" "$d" "$d" "user:${user:-?}" >> "$OUT"
  count=$((count+1))
done < "$TMP/byd"

ok "discovered $count accounts → $OUT  (site+username only, no passwords)"
bold "Top categories:"; awk -F'\t' '!/^#/{c[$2]++} END{for(k in c) printf "  %-10s %d\n", k, c[k]}' "$OUT" | sort -k2 -rn

if $MERGE && [ -f "$INV" ]; then
  added=0
  while IFS=$'\t' read -r pri cat name url a b c notes; do
    [ "${pri:0:1}" = "#" ] && continue; [ -n "$name" ] || continue
    grep -qiF "	$name	" "$INV" && continue
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$pri" "$cat" "$name" "$url" "$a" "$b" "$c" "$notes" >> "$INV"; added=$((added+1))
  done < "$OUT"
  ok "merged $added new account(s) into $INV — run: account-hardening.sh status"
else
  echo "Review $OUT, then merge:  scripts/account-discover.sh --merge"
fi
echo "Reminder: this never read a password. The actual resets are yours, in your browser."
echo
warn "Not covered by this scan (do these by hand):"
echo "  • Safari / iCloud Keychain → System Settings ▸ Passwords (review + import to your manager)"
echo "  • Other macOS user profiles → log into each and re-run, or use --all-users (admin)"
echo "  • Opera 'Air'/GX are included above if installed; confirm they appear in the list."
