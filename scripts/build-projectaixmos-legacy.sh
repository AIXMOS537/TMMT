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

# Paths to strip from the handoff (self-host backend, mesh, local-AI brain, owner tooling).
# Legacy edition has NO backend brain — so the mesh/local-AI/node tooling goes too.
EXCLUDE=(
  "AIXMOS"                              # entire self-host app/portal/docker + owner master docs
  "scripts/setup-mac-imessage-bridge.sh"
  "docs/MAC-IMESSAGE-BRIDGE.md"
  "scripts/sync-airtable.mjs"           # owner's Airtable migration + PAT tooling
  "scripts/retire-vercel-duplicates.sh" # owner Vercel cleanup, not handoff
  # --- no backend brain: strip mesh + local-AI + node-provisioning tooling ---
  "scripts/setup-node.sh"
  "scripts/setup-node.ps1"
  "scripts/mesh-handoff.sh"
  "infra/litellm.config.example.yaml"
  "infra/tailscale-acl.jsonc"
  "litellm.config.yaml"
  "docs/LOCAL-FIRST-AI-STACK.md"
  "docs/MESH-COORDINATION.md"
  "docs/DEVICE-SYNC-PRIVATELLM.md"
  "docs/IT-SUPPORT-TEAM-PLAYBOOK.md"
  "docs/AIXMOS-SYSTEM-INDEX.md"
  "docs/AIXMOS-PLATFORM-BLUEPRINT.md"
  "docs/PROJECTAIXMOS-LEGACY-SPLIT.md"  # owner's internal split spec — not for them
  "docs/FLASH-DEPLOY-RUNBOOK.md"        # owner cleanup runbook
  "docs/THREE-APP-ECOSYSTEM.md"         # owner's multi-app topology
  "docs/OPERATOR-RUNBOOK.md"            # owner mesh operating guide
  "docs/QUICKSTART.md"                  # node/mesh installer guide
  "docs/superpowers"                    # owner internal plans/specs
  "DEPLOY.md"                           # owner three-app deploy (they use LEGACY-DEPLOY-MOE.md)
  "scripts/aixmos.sh"                   # mesh operator CLI (wraps stripped scripts)
  "scripts/build-projectaixmos-legacy.sh" # the builder itself — don't ship it
  # --- owner secrets/memory ---
  ".claude.local.md"
  ".claude/settings.local.json"
)

# References that must NOT survive in the handed-off code (managed-cloud, no brain).
SEVER_PATTERNS='/share/AIXMOS|UGREEN|docker compose|docker-compose|NAS-IP|\bmesh\b|brainiac|LITELLM_BASE|:11434'

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
ok "No self-host/mesh/brain references in src/ or packages/"

# 3b. Stamp the Legacy edition (car rentals, no backend brain).
bold "3b/6  Stamping Legacy edition..."
printf 'legacy\n' > "$OUT/AIXMOS-EDITION"
if [ -f "$OUT/.env.legacy.example" ]; then
  cp "$OUT/.env.legacy.example" "$OUT/.env.example.legacy" 2>/dev/null || true
  ok "edition=legacy stamped; env template: .env.legacy.example"
else
  # fall back: write a minimal managed-cloud env template
  cat > "$OUT/.env.legacy.example" <<'ENVV'
NEXT_PUBLIC_AIXMOS_EDITION=legacy
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AIXMOS_BRAIN_URL=
AIXMOS_LICENSE_KEY=
ENVV
  ok "edition=legacy stamped; wrote .env.legacy.example"
fi
[ -f "$OUT/docs/LEGACY-DEPLOY-MOE.md" ] && ok "deploy guide present: docs/LEGACY-DEPLOY-MOE.md" \
  || warn "docs/LEGACY-DEPLOY-MOE.md not in snapshot (commit it to the source repo)"

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
bold "6/6  Deploy for moe legacy (car rentals) — needs THEIR auth + ownership:"
cat <<'NEXT'
  Full step-by-step: docs/LEGACY-DEPLOY-MOE.md (ships in the bundle).

  a) cp .env.legacy.example .env   → fill THEIR keys (edition already = legacy).
  b) Supabase  : their project → run supabase/migrations/* → confirm RLS on.
  c) GoHighLevel: their sub-account → rental pipeline + payments (docs/GHL-PIPELINE-SETUP.md).
  d) Vercel    : import under THEIR team → set env from .env → deploy.
  e) Launch    : load fleet, intake forms live, test booking + checkout (§4 of guide).

  Backend brain is OFF (AIXMOS_BRAIN_URL blank) — AI features show "Upgrade to
  enable" until they license it. Everything car-rental works without it.

  Acceptance:
    [ ] builds clean   [ ] zero NAS/mesh/brain refs   [ ] runs with your brain offline
    [ ] they hold all their own keys   [ ] AI surface shows upgrade-prompt (brain off)
NEXT
echo ""
ok "ProjectAixmos — Legacy (car rentals, edition=legacy) assembled at: $OUT"
bold "Done."
