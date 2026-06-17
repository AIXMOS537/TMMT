#!/usr/bin/env bash
# new-vertical — spin up a new business vertical lightning fast. Registers it on
# the watch board and scaffolds its profile doc so it shows in watchtower/health
# and has a clear build checklist.   bash scripts/new-vertical.sh "<Name>" [url] [emoji] [codename]
#   (word: vertical)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; C=; BD=; X=; fi

NAME="${1:-}"
if [ -z "$NAME" ]; then
  printf '  New vertical name? (e.g. "Pressure Washing")\n  > '; IFS= read -r NAME || true
fi
[ -n "$NAME" ] || { echo "  ✗ need a name"; exit 1; }
URL="${2:-TODO-set-url}"; EMOJI="${3:-🧩}"; CODE="${4:-The Crew}"
slug="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"

# 1. register on the watch board (idempotent)
TARGETS="$ROOT/watch/targets.tsv"; mkdir -p "$ROOT/watch"; [ -f "$TARGETS" ] || : > "$TARGETS"
if grep -qiF "	$NAME	" "$TARGETS" 2>/dev/null; then
  echo "  ! '$NAME' already on the watch board"
else
  printf '%s\t%s\t%s\t%s\n' "$EMOJI" "$NAME" "$CODE" "$URL" >> "$TARGETS"
  printf '  %s✓%s registered on the watch board\n' "$G" "$X"
fi

# 2. scaffold the vertical profile doc
mkdir -p "$ROOT/docs/verticals"
DOC="$ROOT/docs/verticals/${slug}.md"
if [ -f "$DOC" ]; then echo "  ! profile already exists: docs/verticals/${slug}.md"; else
cat > "$DOC" <<EOF
# ${EMOJI} ${NAME} — vertical profile

> Spun up $(date -u +%Y-%m-%d). Codename owner: ${CODE}. Status: 🟡 building.
> Locked ladder applies: 🚗 Rental → 💳 Membership → 📈 Credit Guidance → 🏗️ Builds/Kits → 🤝 Affiliate.

## What it is
- One-line offer:  _<fill: what the customer gets>_
- Who it's for:    _<fill: target customer>_
- Price tier(s):   _see docs/OFFER-STACK.md_

## Build checklist (lightning)
- [ ] GoHighLevel sub-account + pipeline (compliance vocab where applicable)
- [ ] Airtable base for data + workflows
- [ ] AIXMOS agents wired to intake → follow-up
- [ ] Funnel + leads + ads live (so it earns while it scales)
- [ ] Live URL added to watch/targets.tsv (replace TODO) → shows green in \`health\`
- [ ] Owner remote-in (RustDesk over Tailscale) verified

## Live status
- URL: ${URL}
- Watch: appears in \`watchtower\` / \`health\` once the URL is set.
EOF
printf '  %s✓%s profile scaffolded: docs/verticals/%s.md\n' "$G" "$X" "$slug"
fi

cat <<EOF

  ${BD}${EMOJI} ${NAME} is live on the board.${X}
   next:  fill docs/verticals/${slug}.md · set the real URL in watch/targets.tsv
   check: ${C}health${X}  (it'll show up) · ${C}watchtower${X}

EOF
