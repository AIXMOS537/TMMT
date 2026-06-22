#!/usr/bin/env bash
# parity — keep a LOCAL (editable) and a PRODUCTION version always in sync.
#
# The problem this solves: prod drifted ahead of the repo (migrations applied
# straight to the live DB were never committed), so "local" couldn't rebuild
# "production". This script makes local↔prod parity a one-command habit — for the
# owner AND every teammate.
#
# SAFE BY DEFAULT: pull / diff / status / snapshot only READ from prod.
# Only `push` writes to prod, and it forces a dry-run + typed confirmation first.
#
#   bash scripts/parity.sh setup     one-time per person: tools → link → pull env + schema
#   bash scripts/parity.sh pull      sync prod DOWN → repo (env + schema migrations)
#   bash scripts/parity.sh up        run the app locally (prod-parity)
#   bash scripts/parity.sh localdb   start|stop a LOCAL Supabase mirror (needs Docker)
#   bash scripts/parity.sh diff      show drift between repo migrations and prod
#   bash scripts/parity.sh status    tools, link, env, migration counts (local vs prod)
#   bash scripts/parity.sh snapshot  dump prod schema to backups/ (a safety net)
#   bash scripts/parity.sh push      apply repo migrations UP → prod (guarded)
#   bash scripts/parity.sh doctor    check prerequisites
#
# Wired into the one-word system:  bash scripts/tmmt parity <cmd>
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

# Production project (from `supabase projects list`). Override with env if it ever changes.
PROJECT_REF="${SUPABASE_PROJECT_REF:-uapxakmlwnpfsftfeezx}"
BACKUP_DIR="$ROOT/backups"

# ── tiny output helpers ─────────────────────────────────────────────────────
c_g()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_y()  { printf '\033[33m%s\033[0m\n' "$*"; }
c_r()  { printf '\033[31m%s\033[0m\n' "$*"; }
step() { printf '\n▶ %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# Prefer a locally-installed supabase CLI, else fall back to npx.
sb() {
  if have supabase; then supabase "$@";
  else npx --yes supabase "$@"; fi
}

require_tools() {
  local ok=1
  have node    || { c_r "✗ node not found";    ok=0; }
  if ! have supabase && ! have npx; then c_r "✗ supabase CLI (or npx) not found — npm i -g supabase"; ok=0; fi
  have vercel  || c_y "• vercel CLI not found (needed only for env pull) — npm i -g vercel"
  [ "$ok" = 1 ] || { c_r "Install the missing tools above, then re-run."; return 1; }
  return 0
}

# ── commands ────────────────────────────────────────────────────────────────

cmd_doctor() {
  step "Prerequisites"
  have node    && c_g "✓ node $(node -v)"            || c_r "✗ node"
  have supabase && c_g "✓ supabase $(supabase --version 2>/dev/null)" || c_y "• supabase via npx (slower) or: npm i -g supabase"
  have vercel  && c_g "✓ vercel CLI"                  || c_y "• vercel CLI (env pull): npm i -g vercel"
  have docker  && c_g "✓ docker (needed for localdb)" || c_y "• docker (only for: parity localdb)"
  step "Link"
  if [ -f "$ROOT/supabase/.temp/project-ref" ] || [ -f "$ROOT/.supabase/config.toml" ] || [ -d "$ROOT/supabase" ]; then
    c_g "✓ supabase/ project dir present"
  fi
  echo "  PROJECT_REF = $PROJECT_REF"
}

cmd_link() {
  require_tools || return 1
  step "Linking repo to prod project ($PROJECT_REF)"
  c_y "You'll be asked for the database password (Supabase → Project → Settings → Database)."
  sb link --project-ref "$PROJECT_REF"
}

cmd_pull() {
  require_tools || return 1
  step "1/2 Pull production ENV → .env (so the app runs with real config)"
  if have vercel; then
    vercel env pull .env --environment=production || c_y "vercel env pull failed — link the project with: vercel link"
  else
    c_y "Skipped (no vercel CLI). Install it or copy .env manually."
  fi
  step "2/2 Pull production SCHEMA → repo migrations (ends drift)"
  c_y "This writes any prod-only schema into supabase/migrations/ as a new migration."
  sb db pull --linked || sb db pull
  c_g "✓ Pull complete. Commit the new migration so the repo can rebuild prod."
}

cmd_up() {
  step "Running the app locally (prod-parity)"
  exec bash "$ROOT/scripts/local-up.sh" "${1:-up}"
}

cmd_localdb() {
  require_tools || return 1
  have docker || { c_r "✗ Docker is required for a local Supabase mirror."; return 1; }
  case "${1:-start}" in
    start)
      step "Starting LOCAL Supabase (a safe, editable mirror of prod schema)"
      sb start
      c_g "✓ Local stack up. Point .env.local at the printed local URL/keys to edit safely."
      ;;
    stop) step "Stopping local Supabase"; sb stop ;;
    reset) step "Resetting local DB from repo migrations"; sb db reset ;;
    *) c_r "usage: parity localdb [start|stop|reset]" ;;
  esac
}

cmd_diff() {
  require_tools || return 1
  step "Migrations: repo vs prod"
  sb migration list --linked 2>/dev/null || sb migration list
  step "Schema diff (prod changes not yet in repo migrations)"
  sb db diff --linked 2>/dev/null || c_y "If this errors, run: bash scripts/parity.sh link"
}

cmd_status() {
  cmd_doctor
  step "Env"
  [ -f "$ROOT/.env" ] && c_g "✓ .env present ($(grep -c '=' "$ROOT/.env" 2>/dev/null || echo 0) vars)" || c_y "• no .env — run: parity pull"
  step "Repo migrations"
  local n; n=$(ls "$ROOT"/supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
  echo "  $n migration files committed in supabase/migrations/"
  echo "  (parked, never applied: $(ls "$ROOT"/supabase/migrations/_parked/*.sql 2>/dev/null | wc -l | tr -d ' '))"
}

cmd_snapshot() {
  require_tools || return 1
  mkdir -p "$BACKUP_DIR"
  local f="$BACKUP_DIR/prod-schema-$(date -u +%Y%m%dT%H%M%SZ).sql"
  step "Dumping PROD schema → $f (safety net, no data)"
  sb db dump --linked -f "$f" --schema public 2>/dev/null \
    && c_g "✓ Snapshot saved: $f" \
    || c_y "Snapshot failed — link first: bash scripts/parity.sh link"
}

cmd_push() {
  require_tools || return 1
  c_r "⚠  PUSH applies repo migrations to PRODUCTION ($PROJECT_REF)."
  c_y "Always snapshot + dry-run first."
  step "Dry run (what WOULD be applied)"
  sb db push --linked --dry-run || { c_r "Dry run failed — fix before pushing."; return 1; }
  printf '\nType exactly  APPLY TO PROD  to proceed (anything else cancels): '
  local ans; read -r ans
  [ "$ans" = "APPLY TO PROD" ] || { c_y "Cancelled. Nothing applied."; return 0; }
  cmd_snapshot
  step "Applying to prod"
  sb db push --linked && c_g "✓ Applied. Verify in the dashboard + run: parity diff"
}

case "${1:-help}" in
  setup)    shift; require_tools && cmd_link && cmd_pull ;;
  doctor)   shift; cmd_doctor ;;
  link)     shift; cmd_link ;;
  pull)     shift; cmd_pull ;;
  up)       shift; cmd_up "${1:-up}" ;;
  localdb)  shift; cmd_localdb "${1:-start}" ;;
  diff)     shift; cmd_diff ;;
  status)   shift; cmd_status ;;
  snapshot) shift; cmd_snapshot ;;
  push)     shift; cmd_push ;;
  *)
    sed -n '2,30p' "$ROOT/scripts/parity.sh" | sed 's/^# \{0,1\}//'
    ;;
esac
