#!/usr/bin/env bash
#
# costcut.sh — one look at every dollar leaving and every stale thing dragging
# the business down, with the exact move to kill each. Read-only by default:
# it tells you what to cut; you (or `--apply` on the safe ones) pull the trigger.
# ---------------------------------------------------------------------------
#   bash scripts/costcut.sh            # the full audit (safe, read-only)
#   bash scripts/costcut.sh --apply    # also run the safe automatic cuts
# ---------------------------------------------------------------------------
# Philosophy: local-first by default (your hardware is already paid for), pay
# only on the rare hard task, and let nothing rot silently. See
# docs/COST-AND-OBSOLESCENCE.md and docs/LOCAL-FIRST-AI-STACK.md.
set -uo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

h(){ printf "\n\033[1;96m── %s ─────────────────────────────\033[0m\n" "$1"; }
drain(){ printf "  \033[101;97m 💸 \033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
stale(){ printf "  \033[43;30m 🥀 \033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
ok(){    printf "  \033[42;30m ✓ \033[0m %s\n" "$1"; }
run(){ if $APPLY; then printf "  \033[100;97m run \033[0m %s\n" "$*"; "$@" || true; else printf "  \033[2mwould run: %s\033[0m\n" "$*"; fi; }

printf "\033[1m💰 COST + STALENESS AUDIT\033[0m  —  cut what bleeds, retire what rots\n"
printf "\033[2m%s · read-only unless --apply\033[0m\n" "$(date '+%Y-%m-%d %H:%M')"

# ── 1. PAID AI vs LOCAL — the biggest recurring lever ───────────────────────
h "AI SPEND  (local-first = near-zero)"
if [ -f docs/LOCAL-FIRST-AI-STACK.md ]; then
  ok "Local-first stack documented (LiteLLM router → local models, escalate by exception)"
else
  drain "No local-first router — every call may hit a paid API" "build docs/LOCAL-FIRST-AI-STACK.md routing; local by default"
fi
if grep -rqiE 'ANTHROPIC_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY' .env 2>/dev/null; then
  stale "Hosted-model keys present in .env — make sure they're escalation-only, not the default path" "route EASY/MED tasks to local (Ollama/qwen); pay only on HARD"
fi
drain "Per-seat AI subscriptions (Cursor/Copilot/etc.) across operators add up" "share one LiteLLM endpoint on the tailnet; operators hit local, not their own paid seats"

# ── 2. VERCEL — duplicate projects re-deploy on every push ──────────────────
h "HOSTING  (Vercel build minutes + projects)"
if [ -x scripts/retire-vercel-duplicates.sh ]; then
  drain "Legacy duplicate Vercel projects (tmmt-c919, tmmt) redeploy the SAME repo on every push — double/triple build minutes" "bash scripts/retire-vercel-duplicates.sh --apply"
  $APPLY && run bash scripts/retire-vercel-duplicates.sh --apply
else
  ok "No retire-duplicates script flagged"
fi
drain "Preview deploys on every branch/PR burn the free tier" "in Vercel project settings, limit preview deploys to PRs touching app code; mute swarm-coord branches"

# ── 3. SUPABASE / DATABASES — idle projects still bill or pause-rot ──────────
h "DATABASES  (Supabase projects)"
drain "Extra Supabase projects beyond what's live cost money or auto-pause and rot" "consolidate tenants behind RLS on ONE project (you already have RLS); pause/delete unused"
stale "Free-tier projects PAUSE after inactivity — a paused DB looks 'broken' to a client" "scripts/heartbeat.sh + a weekly ping keeps live ones warm; delete the truly-dead"

# ── 4. SUBSCRIPTIONS — pay for what you don't use ───────────────────────────
h "SUBSCRIPTIONS  (the silent monthly bleed)"
INV="config/account-inventory.example.tsv"
if [ -f "$INV" ]; then
  ok "Account inventory exists — use it to spot every recurring charge"
  printf "      \033[2msubs rows:\033[0m\n"
  grep -iE 'subs-|subscription' "$INV" 2>/dev/null | sed 's/^/      /' | head -10
fi
drain "Cancel any tool used by <1 person or not in the last 30 days" "list every recurring charge in your bank/Stripe; cancel unused = less spend AND less attack surface"

# ── 5. STALENESS — things that rot and hurt the business if left alone ───────
h "STALENESS  (what rots if untouched)"
# stale git branches
NBR=$(git branch -r 2>/dev/null | grep -vE 'HEAD|master|main' | wc -l | tr -d ' ')
[ "${NBR:-0}" -gt 8 ] && stale "$NBR remote branches — old feature branches confuse deploys and reviews" "delete merged/dead branches: git push origin --delete <branch>"
# secret rot
if [ -x scripts/secret-scan.sh ]; then ok "secret-scan present — rotate keys before they leak/expire"; fi
grep -rqi 'AIRTABLE_TOKEN_REVOKED\|REVOKE.*Airtable' docs config 2>/dev/null && \
  drain "Airtable PAT still flagged for revocation — a live exposed key is pure risk" "airtable.com/create/tokens → delete the old PAT (only you can; it's your account)"
# dependency rot
if [ -f package.json ]; then
  stale "npm dependencies drift — stale deps = security holes + broken builds later" "npm outdated  →  bump majors deliberately; run npm run build to gate"
fi
# doc rot
stale "Docs/roadmap go stale and mislead the team" "STATUS.md + ROADMAP.md: review monthly; delete what shipped, cut what you won't build (YAGNI)"
# device/account rot
[ -x scripts/device-integrity.sh ] && ok "device-integrity + account-hardening keep machines/logins from rotting"

# ── 6. PEOPLE/PROCESS DRAG — what wastes the most expensive resource: you ───
h "YOUR TIME  (the costliest line item)"
ok "Away-Mode queue (scripts/queue.sh) keeps decisions moving while you're physically out"
ok "new-business.sh stamps a whole business in one command — no rebuild cost per launch"
drain "Anything you do by hand more than twice = a script you don't have yet" "queue it; the next idle build turns it into one command"

# ── SUMMARY ─────────────────────────────────────────────────────────────────
h "THE ONE-LINE PLAN"
cat <<'PLAN'
  1. AI:        local by default, pay only on HARD  → docs/LOCAL-FIRST-AI-STACK.md
  2. Hosting:   kill duplicate Vercel projects      → retire-vercel-duplicates.sh --apply
  3. Database:  one Supabase + RLS, delete the rest
  4. Subs:      cancel anything unused in 30 days
  5. Rot:       rotate the Airtable key, prune branches, npm outdated, review docs monthly
  6. Time:      automate anything done >2x; queue the rest
PLAN
printf "\n\033[2m  read-only audit. re-run with --apply to fire the safe automatic cuts.\033[0m\n"
$APPLY || printf "\033[2m  full plan + numbers: docs/COST-AND-OBSOLESCENCE.md\033[0m\n"
