#!/usr/bin/env bash
#
# brainiac-handoff.sh — pack "all relevant info" for the BRAIN (Brainiac Windows
# PC / NAS) node so it can fast-track the NEXT project. Called by the factory
# line on every green pass; also runnable standalone.
# ---------------------------------------------------------------------------
# The BRAIN node is the backend memory of the mesh (MESH-COORDINATION.md §1).
# This writes a portable, SECRET-SAFE brief it can ingest to skip re-discovery:
#   • what changed (branch, sha, files touched)
#   • latest QA truth (verify-gate result)
#   • accumulated factory-line learnings (what made the mesh stronger)
#   • the current mission / next-project hints (HANDOFF.md, CURSOR-RUN.md)
#   • environment readiness — VARIABLE NAMES ONLY, values NEVER printed
#
# It writes to .aixmos/brainiac/fast-track-<ts>.md and updates
# .aixmos/brainiac/LATEST.md. With --push it also emits a git-bus handoff to
# BRAIN via scripts/mesh-handoff.sh.
#
# SAFETY: read-only w.r.t. the app. Prints NO secret values (only "set"/"unset").
# Never deploys, merges, or sends.
#
# Usage:
#   bash scripts/brainiac-handoff.sh                 # write the packet locally
#   bash scripts/brainiac-handoff.sh --node FORGE    # tag which node produced it
#   bash scripts/brainiac-handoff.sh --brief "..."   # add a one-line mission note
#   bash scripts/brainiac-handoff.sh --push          # also emit a handoff branch to BRAIN
#   bash scripts/brainiac-handoff.sh --dry           # write packet, never touch git remote
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'; else G=; Y=; C=; B=; D=; X=; fi
ok()   { printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
warn() { printf '%s  ! %s%s\n' "$Y" "$*" "$X"; }
ts()   { date -u +%Y-%m-%dT%H:%M:%SZ; }

NODE="${AIXMOS_NODE:-CLOUD}"; BRIEF=""; PUSH=false; DRY=false
while [ $# -gt 0 ]; do
  case "$1" in
    --node)  NODE="$(printf '%s' "${2:?}" | tr '[:lower:]' '[:upper:]')"; shift 2 ;;
    --brief) BRIEF="${2:?}"; shift 2 ;;
    --push)  PUSH=true; shift ;;
    --dry)   DRY=true; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) warn "ignoring unknown arg: $1"; shift ;;
  esac
done

# DARK stops even the brain packer.
[ -f "$ROOT/.swarm/DARK" ] && { warn "DARK — not packing. Lift with: bash scripts/godark lift"; exit 1; }

OUTDIR="$ROOT/.aixmos/brainiac"; mkdir -p "$OUTDIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
PACKET="$OUTDIR/fast-track-$STAMP.md"

SHA="$(git rev-parse --short HEAD 2>/dev/null || echo '-')"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '-')"
BASE="$(git merge-base HEAD origin/master 2>/dev/null || echo '')"
CHANGED="$( { [ -n "$BASE" ] && git diff --name-only "$BASE"..HEAD; git diff --name-only; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u | grep -v '^$' | head -40)"

# Latest QA truth (last line of verify-gate audit, if present).
QA_LINE="$(tail -1 "$ROOT/.aixmos/verify-log.ndjson" 2>/dev/null || echo '(no verify-gate log yet)')"
# Accumulated factory-line learnings.
LINE_TAIL="$(tail -8 "$ROOT/.aixmos/factory-line.ndjson" 2>/dev/null || echo '(no factory-line passes recorded yet)')"

# Env readiness — NAMES ONLY, never values. Names come from .env.example.
env_status() {
  local names status="" v
  names="$(grep -oE '^[A-Z0-9_]+=' "$ROOT/.env.example" 2>/dev/null | sed 's/=$//' | sort -u)"
  for v in $names; do
    if [ -n "${!v:-}" ]; then status+="  - $v: set"$'\n'; else status+="  - $v: unset"$'\n'; fi
  done
  printf '%s' "${status:-  (no .env.example found)}"
}

# Next-project hints — pull the current mission cheaply from known files.
HANDOFF_HINT="$( [ -f "$ROOT/HANDOFF.md" ] && sed -n '1,20p' "$ROOT/HANDOFF.md" || echo '(no active HANDOFF.md on this branch)')"

cat > "$PACKET" <<EOF
# BRAINIAC FAST-TRACK PACKET
generated: $(ts)
from-node: $NODE
branch: $BRANCH
sha: $SHA
mission-note: ${BRIEF:-"(none)"}

> Ingest this on the BRAIN (Brainiac Windows/NAS) node to skip re-discovery and
> start the next project already knowing the state of the mesh. Secret-safe:
> only variable NAMES appear below, never values.

## 1. What changed on this branch
\`\`\`
${CHANGED:-"(no file changes detected vs origin/master)"}
\`\`\`

## 2. Latest QA truth (verify-gate)
\`\`\`
$QA_LINE
\`\`\`

## 3. Factory-line learnings (recent passes — the mesh getting stronger)
\`\`\`
$LINE_TAIL
\`\`\`

## 4. Current mission / next-project hints
\`\`\`
$HANDOFF_HINT
\`\`\`
See also: CURSOR-RUN.md, docs/AIXMOS-TMMT-FUNNEL.md, docs/MESH-COORDINATION.md.

## 5. Environment readiness (names only — configure the "unset" ones to go live)
$(env_status)

## 6. Guardrails carried forward (never regress)
- Compliance gates locked (shared/compliance-gates/gates.config.json) — only the owner flips, after legal.
- Owner-approval gate on money/legal/prod/send (shared/owner-approval-gate/).
- Never merge to master / deploy / send external without owner confirm (MESH-COORDINATION.md §4).
EOF

cp "$PACKET" "$OUTDIR/LATEST.md"
ok "fast-track packet → ${PACKET#$ROOT/}"
ok "latest pointer     → .aixmos/brainiac/LATEST.md"

if $PUSH && ! $DRY; then
  if [ -f "$ROOT/scripts/mesh-handoff.sh" ]; then
    bash "$ROOT/scripts/mesh-handoff.sh" --from "$NODE" --to BRAIN \
      --intent "${BRIEF:-"Fast-track packet — ingest mesh state for the next project"}" \
      --slug "brainiac-fasttrack-$STAMP" \
      --context "packet at .aixmos/brainiac/fast-track-$STAMP.md" \
      --accept "BRAIN ingests packet" --accept "next project pre-loaded" \
      --guard "read-only intel; do not act on money/legal/prod/send" \
      --reply-to "$NODE" --push \
      && ok "handoff branch emitted to BRAIN" \
      || warn "handoff emit failed (branch may exist) — check manually"
  else
    warn "mesh-handoff.sh missing — packet written locally only"
  fi
else
  printf '%s   (local packet only; add --push to emit a git-bus handoff to BRAIN)%s\n' "$D" "$X"
fi
