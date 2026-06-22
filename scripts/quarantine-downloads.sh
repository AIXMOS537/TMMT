#!/usr/bin/env bash
# quarantine-downloads.sh — move secrets/PII out of ~/Downloads (owner or operator Mac)
# Safe, repeatable. Does NOT delete — moves to ~/.aixmos/SECURITY-QUARANTINE (chmod 700).
set -uo pipefail
VAULT="$HOME/.aixmos/SECURITY-QUARANTINE"
mkdir -p "$VAULT" && chmod 700 "$HOME/.aixmos" "$VAULT"
moved=0
for pat in \
  'dashlane_account_recovery_key.txt' \
  'github-recovery-codes.txt' \
  'TMMT_OWNER_PASSWORD=*' \
  'SS card .pdf' \
  '*Bank statement*.pdf' \
  '*recovery*code*' \
  '*password*.png' \
  '*password*.txt'; do
  while IFS= read -r f; do
    [ -e "$f" ] || continue
    base="$(basename "$f")"
    mv "$f" "$VAULT/$base" 2>/dev/null && { echo "quarantined: $base"; moved=$((moved+1)); }
  done < <(find "$HOME/Downloads" -maxdepth 1 -name "$pat" 2>/dev/null)
done
echo "Done. $moved file(s) → $VAULT"
echo "Store values in Dashlane, then delete quarantine copies when confirmed."
