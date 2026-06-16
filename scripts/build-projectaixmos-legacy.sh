#!/usr/bin/env bash
#
# build-projectaixmos-legacy.sh
# ---------------------------------------------------------------------------
# Materialize "ProjectAixmos — Legacy": a backend-less, managed-cloud-only
# clone of this stack for handoff to mod legacy. No NAS / mesh / brain-PC
# dependency. The owner keeps the full mesh-connected build untouched.
#
# Spec: docs/PROJECTAIXMOS-LEGACY-SPLIT.md
# Runbook: docs/FLASH-DEPLOY-RUNBOOK.md
#
# WHAT IT DOES (deterministic, repo-only):
#   1. Snapshots tracked files via `git archive` (no node_modules/.next/secrets).
#   2. Strips the EXCLUDE set (self-host backend, mesh, owner secrets/tooling).
#   3. Severs check: greps the result for NAS/mesh refs; fails if any remain.
#   4. (--build) installs deps + runs `npm run build` to prove it stands alone.
#   5. (--git)   initializes a fresh git repo on a `legacy/init` branch.
#   6. Prints the manual cloud-provisioning steps it CANNOT do (their own
#      Supabase / GHL / Vercel — those need interactive auth & ownership).
#
# Default is DRY-RUN. Re-run with --apply to actually write the output dir.
#
# Usage:
#   bash scripts/build-projectaixmos-legacy.sh                 # dry-run preview
#   bash scripts/build-projectaixmos-legacy.sh --apply         # build it
#   bash scripts/build-projectaixmos-legacy.sh --apply --build --git
#   OUT=/path/to/dir bash scripts/build-projectaixmos-legacy.sh --apply
# ---------------------------------------------------------------------------
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }
die()  { printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

APPLY=false; DO_BUILD=false; DO_GIT=false
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --build) DO_BUILD=true ;;
    --git)   DO_GIT=true ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown arg: $arg (try --help)" ;;
  esac
done

# Repo root = parent of this script's dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="${OUT:-$(dirname "$REPO_ROOT")/projectaixmos-legacy}"

command -v git >/dev/null 2>&1 || die "git not found."
[ -d "$REPO_ROOT/.git" ] || die "Not a git repo: $REPO_ROOT"

# Paths to strip from the handoff (self-host backend, mesh, owner secrets/tooling).
EXCLUDE=(
  "AIXMOS/docker"                       # NAS Docker/nginx — the brain box
  "AIXMOS/portal"                       # served from NAS volumes
  "AIXMOS/files"                        # served from NAS volumes
  "scripts/setup-mac-imessage-bridge.sh"
  "docs/MAC-IMESSAGE-BRIDGE.md"
  "scripts/sync-airtable.mjs"           # owner's Airtable migration + PAT tooling
  "scripts/retire-vercel-duplicates.sh" # owner Vercel cleanup, not handoff
  ".claude.local.md"                    # owner personal/operational memory (gitignored)
  ".claude/settings.local.json"         # owner local settings
)

# References that must NOT survive in the handed-off code (managed-cloud only).
SEVER_PATTERNS='/share/AIXMOS|UGREEN|docker compose|docker-compose|NAS-IP|\bmesh\b|brainiac'

bold "== ProjectAixmos — Legacy build =="
echo "Source repo : $REPO_ROOT"
echo "Output dir  : $OUT"
echo "Mode        : $([ "$APPLY" = true ] && echo APPLY || echo DRY-RUN)"
echo "Build       : $DO_BUILD     Git init: $DO_GIT"
echo ""
bold "Will EXCLUDE from the handoff:"
for p in "${EXCLUDE[@]}"; do echo "  ✗ $p"; done
echo ""

if [ "$APPLY" != true ]; then
  warn "Dry run — nothing written. Re-run with --apply to build."
  echo "    bash scripts/build-projectaixmos-legacy.sh --apply --build --git"
  exit 0
fi

# 1. Clean snapshot of tracked files only (no node_modules/.next/.env).
[ -e "$OUT" ] && die "Output dir already exists: $OUT (move or remove it first)."
mkdir -p "$OUT"
bold "1/6  Snapshotting tracked files via git archive..."
git -C "$REPO_ROOT" archive --format=tar HEAD | tar -x -C "$OUT"
ok "Snapshot extracted to $OUT"

# 2. Strip the EXCLUDE set.
bold "2/6  Stripping EXCLUDE set..."
for p in "${EXCLUDE[@]}"; do
  if [ -e "$OUT/$p" ]; then rm -rf "${OUT:?}/$p"; ok "removed $p"; else warn "absent (skipped) $p"; fi
done

# 3. Sever check — no self-host/mesh refs may remain in shippable code.
bold "3/6  Severing check (no NAS/mesh/self-host refs)..."
HITS="$(grep -rInE "$SEVER_PATTERNS" "$OUT/src" "$OUT/packages" 2>/dev/null || true)"
if [ -n "$HITS" ]; then
  warn "Self-host / mesh references still present in shippable code:"
  echo "$HITS"
  die "Resolve each to a managed service (Supabase/GHL) or remove it, then re-run."
fi
ok "No self-host/mesh references in src/ or packages/"

# 4. Optional: prove it builds standalone.
if [ "$DO_BUILD" = true ]; then
  bold "4/6  Installing deps + building (proves it stands alone)..."
  ( cd "$OUT" && npm ci && npm run build ) || die "Build failed — fix before handoff."
  ok "Build green"
else
  warn "4/6  Skipped build (pass --build to verify it stands alone)."
fi

# 5. Optional: fresh git history on legacy/init.
if [ "$DO_GIT" = true ]; then
  bold "5/6  Initializing fresh git repo (branch legacy/init)..."
  # Disable commit signing for this fresh repo so init never depends on the
  # host's signing config (the legacy repo gets its own identity at handoff).
  ( cd "$OUT" && git init -q && git checkout -q -b legacy/init && git add -A \
      && git -c commit.gpgsign=false -c gpg.format=openpgp commit -q \
           -m "chore: ProjectAixmos legacy edition (backend-less, managed-cloud only)" )
  ok "git repo ready on legacy/init"
else
  warn "5/6  Skipped git init (pass --git to start fresh history)."
fi

# 6. The cloud provisioning this script intentionally does NOT do.
bold "6/6  Manual cloud handoff (needs THEIR auth + ownership):"
cat <<'NEXT'
  These require interactive login and must be owned by mod legacy — not scripted:

  a) Supabase  : new project → run supabase/migrations/* → confirm RLS on.
  b) GoHighLevel: new sub-account/location → re-tag pipeline (docs/GHL-PIPELINE-SETUP.md).
  c) Vercel    : new projects under THEIR team → set env from THEIR Supabase/GHL only.
  d) Hand off  : transfer the new repo + Vercel + Supabase + GHL ownership.

  Acceptance (docs/PROJECTAIXMOS-LEGACY-SPLIT.md §5):
    [ ] builds clean   [ ] zero NAS/mesh refs   [ ] runs with your brain PC offline
    [ ] they hold all their own keys   [ ] agents/VAs can operate it solo
NEXT
echo ""
ok "ProjectAixmos — Legacy assembled at: $OUT"
bold "Done."
