#!/usr/bin/env bash
# check-my-ad.sh — is my ad/sales copy SAFE to post? (credit + funding)
# Green = post it. Red = fix the flagged words first. Never post red.
#   bash scripts/check-my-ad.sh myad.txt
#   echo "We guarantee to delete your debt" | bash scripts/check-my-ad.sh
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
printf "\033[1m== checking your ad (credit/funding rules) ==\033[0m\n"
node "$DIR/compliance-check.mjs" --product credit_repair "$@"
rc=$?
if [ "$rc" -eq 0 ]; then printf "\033[42;30m SAFE TO POST \033[0m (add the disclosures if it warned)\n"
else printf "\033[41;97m DO NOT POST \033[0m fix the flagged lines, then check again.\n"; fi
exit $rc
