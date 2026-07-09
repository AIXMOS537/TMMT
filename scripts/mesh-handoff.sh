#!/usr/bin/env bash
#
# mesh-handoff.sh — emit a node-to-node handoff over the git message bus.
# ---------------------------------------------------------------------------
# The agent mesh (CARRY / FORGE / BRAIN / CLOUD) coordinates through git: a
# branch is a message, HANDOFF.md is the sentence. This emits one in a single
# command — create the handoff branch, write the task card, push it, and print
# the Slack ping to wake the receiver.
#
# Protocol: docs/MESH-COORDINATION.md
#
# Usage:
#   scripts/mesh-handoff.sh --from FORGE --to CLOUD \
#     --intent "Rotate Airtable PAT and update Vercel env" \
#     --slug airtable-rotate \
#     [--context "see docs/FLASH-DEPLOY-RUNBOOK.md §3"] \
#     [--accept "new PAT issued" --accept "dry-run sync passes"] \
#     [--guard "do not commit the token"] \
#     [--reply-to "ping CARRY in Slack"] \
#     [--push]            # actually push (default: local only, prints next step)
#
# Nodes: CARRY (carry Mac) · FORGE (M1 Mac Pro) · BRAIN (PC/NAS) · CLOUD (web Claude)
# ---------------------------------------------------------------------------
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }
die()  { printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

FROM=""; TO=""; INTENT=""; SLUG=""; CONTEXT=""; GUARD=""; REPLY=""; PUSH=false
ACCEPT=()
while [ $# -gt 0 ]; do
  case "$1" in
    --from)     FROM="${2:?}"; shift 2 ;;
    --to)       TO="${2:?}"; shift 2 ;;
    --intent)   INTENT="${2:?}"; shift 2 ;;
    --slug)     SLUG="${2:?}"; shift 2 ;;
    --context)  CONTEXT="${2:?}"; shift 2 ;;
    --accept)   ACCEPT+=("${2:?}"); shift 2 ;;
    --guard)    GUARD="${2:?}"; shift 2 ;;
    --reply-to) REPLY="${2:?}"; shift 2 ;;
    --push)     PUSH=true; shift ;;
    -h|--help)  grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown arg: $1 (try --help)" ;;
  esac
done

VALID="CARRY FORGE BRAIN CLOUD"
upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }
FROM="$(upper "$FROM")"; TO="$(upper "$TO")"
[ -n "$FROM" ] && [ -n "$TO" ] && [ -n "$INTENT" ] && [ -n "$SLUG" ] \
  || die "Required: --from --to --intent --slug (see --help)"
case " $VALID " in *" $FROM "*) :;; *) die "--from must be one of: $VALID";; esac
case " $VALID " in *" $TO "*) :;; *) die "--to must be one of: $VALID";; esac
[ "$FROM" != "$TO" ] || die "--from and --to must differ."
command -v git >/dev/null 2>&1 || die "git not found."
# slug: lowercase, safe chars only
SLUG="$(printf '%s' "$SLUG" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
[ -n "$SLUG" ] || die "--slug reduced to empty; use a-z0-9 and dashes."

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
BRANCH="handoff/$(printf '%s' "$FROM" | tr '[:upper:]' '[:lower:]')-to-$(printf '%s' "$TO" | tr '[:upper:]' '[:lower:]')/$SLUG"

git rev-parse --verify "$BRANCH" >/dev/null 2>&1 && die "Branch already exists: $BRANCH"
[ -z "$(git status --porcelain)" ] || warn "Working tree not clean — handoff is created from current HEAD."

bold "== mesh handoff: $FROM → $TO =="
echo "branch : $BRANCH"
echo "intent : $INTENT"

# Build acceptance list (default placeholder if none given).
[ ${#ACCEPT[@]} -gt 0 ] || ACCEPT=("define and check the outcome")
ACC_BLOCK=""
for a in "${ACCEPT[@]}"; do ACC_BLOCK+="  - $a"$'\n'; done

git checkout -q -b "$BRANCH"
cat > HANDOFF.md <<EOF
# HANDOFF
from: $FROM
to: $TO
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
intent: $INTENT
context: ${CONTEXT:-"(none)"}
acceptance:
${ACC_BLOCK}guardrails: ${GUARD:-"standard mesh guardrails — see docs/MESH-COORDINATION.md §4"}
reply-to: ${REPLY:-"ping CARRY in Slack #new-channel"}

---
## result (receiver fills this in)
status: open
notes:
EOF

git add HANDOFF.md
git -c commit.gpgsign=false commit -q -m "handoff(${FROM}→${TO}): $INTENT"
ok "HANDOFF.md committed on $BRANCH"

PING="📤 handoff \`$BRANCH\` FROM $FROM TO $TO: $INTENT"
if $PUSH; then
  bold "Pushing..."
  for i in 1 2 3 4; do
    git push -u origin "$BRANCH" 2>&1 && { ok "pushed"; break; } || { warn "push $i failed; backoff"; sleep $((2**i)); }
  done
else
  warn "Local only. Push when ready:  git push -u origin $BRANCH"
fi
echo ""
bold "Wake the receiver — post to Slack #new-channel:"
echo "  $PING"
echo ""
ok "Handoff emitted. $TO picks it up via the loop in docs/MESH-COORDINATION.md §5."
