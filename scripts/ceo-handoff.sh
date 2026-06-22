#!/usr/bin/env bash
# ceo-handoff — PROJECT X HAILMARY. The single command a LIEUTENANT runs so the
# CEO (Muhammad Taha) never has to touch setup. It chains the safe, credential-
# bound steps that only a human-with-keys can do, reports up, and stops.
#
# WHO RUNS THIS: a delegate (Nightwing / Crew) — NOT the CEO.
# WHAT IT DOES (all safe, owner-reviewable):
#   1) parity doctor   — confirm tools
#   2) parity setup    — link repo to prod + pull schema/env  → ENDS THE DRIFT
#   3) commit the pulled prod migrations onto a branch (so the repo rebuilds prod)
#   4) Pocket assistant env check (POCKET_BRAIN_URL) — prompt, never fabricate
#   5) parity diff     — show what (if anything) still differs
#   6) ceo brief       — print the CEO cockpit so the Boss can verify at a glance
#
# It NEVER pushes to prod or to master automatically. The delegate reviews + PRs.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; BD=; X=; fi
say()  { printf '\n%s▶ %s%s\n' "$BD" "$*" "$X"; }
ok()   { printf '%s✓ %s%s\n' "$G" "$*" "$X"; }
warn() { printf '%s• %s%s\n' "$Y" "$*" "$X"; }
RECEIPT="$ROOT/.hailmary/ceo-handoff.log"; mkdir -p "$ROOT/.hailmary" 2>/dev/null
log() { echo "$(date -u +%FT%TZ) $*" >> "$RECEIPT" 2>/dev/null || true; }

cat <<EOF
${C}${BD}
   ╔══════════════════════════════════════════════════════════╗
   ║   👑  CEO HANDOFF  ·  PROJECT X HAILMARY                  ║
   ╚══════════════════════════════════════════════════════════╝${X}
   Run by a LIEUTENANT (Nightwing / Crew). The CEO only reviews.
   Nothing is pushed to prod or master automatically.
EOF
log "ceo-handoff start by $(whoami)@$(hostname -s 2>/dev/null)"

# 1) tools
say "1/6  Checking tools"
bash "$ROOT/scripts/parity.sh" doctor || true

# 2) ends the drift (link + pull prod → repo). Needs the DB password — delegate enters it.
say "2/6  Syncing PRODUCTION → local (ends the drift)"
warn "You'll be asked for the Supabase DB password (delegate has it; CEO does not)."
if bash "$ROOT/scripts/parity.sh" setup; then ok "Prod schema + env pulled into the repo"; log "parity setup ok"
else warn "Setup incomplete — fix the printed issue and re-run. (Common: 'supabase login' / 'vercel login' first.)"; log "parity setup incomplete"; fi

# 3) commit the pulled migrations so the repo can rebuild prod (branch, not master)
say "3/6  Committing the pulled prod schema (so the repo always rebuilds prod)"
if [ -n "$(git status --porcelain supabase/migrations 2>/dev/null)" ]; then
  BR="chore/end-drift-$(date -u +%Y%m%d%H%M)"
  git checkout -b "$BR" 2>/dev/null || git checkout "$BR" 2>/dev/null || true
  git add supabase/migrations .env.example 2>/dev/null
  git commit -m "chore: pull production schema into repo (end drift)" >/dev/null 2>&1 \
    && ok "Committed on $BR — push it and open a PR for review" || warn "Nothing to commit"
  log "drift commit on $BR"
else
  ok "No new prod-only migrations — repo already matches prod"
fi

# 4) Pocket assistant — turn on the one net-new feature (needs an env var only)
say "4/6  AIXMOS Pocket assistant (the net-new piece — no migration needed)"
if grep -q '^POCKET_BRAIN_URL=' "$ROOT/.env" 2>/dev/null && [ -n "$(grep '^POCKET_BRAIN_URL=' "$ROOT/.env" 2>/dev/null | cut -d= -f2-)" ]; then
  ok "POCKET_BRAIN_URL is set — Pocket can run on the live token ledger"
else
  warn "POCKET_BRAIN_URL not set. To switch Pocket on, set it where the app runs:"
  printf '     • Local:   echo "POCKET_BRAIN_URL=<your self-hosted brain url>" >> .env\n'
  printf '     • Prod:    vercel env add POCKET_BRAIN_URL production\n'
  warn "No fabricated value — a real self-hosted endpoint is required."
fi
log "pocket env checked"

# 5) drift visibility
say "5/6  Drift check (repo vs prod)"
bash "$ROOT/scripts/parity.sh" diff || warn "Run 'parity link' if this errored."

# 6) hand the cockpit to the CEO
say "6/6  CEO cockpit (the Boss reviews — no action required)"
bash "$ROOT/scripts/ceo" brief 2>/dev/null || bash "$ROOT/scripts/ceo" 2>/dev/null || true

cat <<EOF

${G}${BD}   HANDOFF COMPLETE.${X}
   What the CEO sees: the cockpit above. What the CEO does: nothing.
   Delegate's only follow-ups (if flagged): push the drift branch + open a PR,
   and set POCKET_BRAIN_URL. Receipt: .hailmary/ceo-handoff.log
EOF
log "ceo-handoff complete"
