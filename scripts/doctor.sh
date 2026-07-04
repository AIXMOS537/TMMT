#!/usr/bin/env bash
#
# doctor.sh — the franchise opening checklist. Run this on ANY machine (new Mac,
# new PC, an operator's laptop) and get ONE answer: is this place ready to open?
# Same check, every location — like a McDonald's morning open. No guesswork.
# ---------------------------------------------------------------------------
#   bash scripts/doctor.sh           # full check, one GREEN/RED verdict
#   bash scripts/doctor.sh --quiet   # only failures + verdict
# ---------------------------------------------------------------------------
# Read-only. Touches nothing, prints no secrets. It tells you what's missing and
# the exact next move. Pairs with check-env.mjs (env detail) + verify-gate.sh (code).
set -uo pipefail

QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

PASS=0; FAIL=0; WARN=0
ok(){   PASS=$((PASS+1)); $QUIET || printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad(){  FAIL=$((FAIL+1)); printf "  \033[31m✗\033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
warn(){ WARN=$((WARN+1)); printf "  \033[33m!\033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
h(){ $QUIET || printf "\n\033[1;96m── %s ──\033[0m\n" "$1"; }

printf "\033[1m🩺 FRANCHISE DOCTOR\033[0m  —  is this machine ready to open?\n"
printf "\033[2m%s · %s\033[0m\n" "$(date '+%Y-%m-%d %H:%M')" "$ROOT"

# ── 1. TOOLING — the equipment has to be plugged in ─────────────────────────
h "TOOLING"
for tool in git node npm bash; do
  if command -v "$tool" >/dev/null 2>&1; then ok "$tool ($("$tool" --version 2>&1 | head -1 | tr -d '\n'))"
  else bad "$tool missing" "install $tool — it's required to run the system"; fi
done

# ── 2. REPO — right place, known state ──────────────────────────────────────
h "REPO"
if git rev-parse --git-dir >/dev/null 2>&1; then
  REMOTE="$(git remote get-url origin 2>/dev/null || echo none)"
  BR="$(git branch --show-current 2>/dev/null || echo '?')"
  DIRTY="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  echo "$REMOTE" | grep -qiE 'AIXMOS537/TMMT|Metavibez4L/TMMT' \
    && ok "remote is your repo ($BR)" \
    || warn "remote isn't your TMMT repo: $REMOTE" "confirm before pushing"
  [ "$DIRTY" = 0 ] && ok "working tree clean" || warn "$DIRTY uncommitted change(s)" "commit or stash before a fresh boot"
else
  bad "not a git repo" "clone the repo first, then run from inside it"
fi

# ── 3. SCRIPTS — every tool on the board must exist, run, and parse ─────────
h "SCRIPTS (the board)"
BOARD=$(grep -oE 'scripts/[a-z0-9-]+\.(sh|mjs)' scripts/oneshot.sh 2>/dev/null | sort -u)
missing=0
for s in $BOARD; do
  if [ ! -f "$s" ]; then bad "$s referenced by board but missing" "restore it: git checkout origin/$BR -- $s"; missing=1
  elif [[ "$s" == *.sh ]] && ! bash -n "$s" 2>/dev/null; then bad "$s has a syntax error" "fix the script before relying on it"; missing=1
  elif [ ! -x "$s" ]; then warn "$s not executable" "chmod +x $s"; fi
done
[ "$missing" = 0 ] && ok "all board scripts present + parse clean ($(echo "$BOARD" | wc -w | tr -d ' ') tools)"
for entry in scripts/oneshot.sh scripts/booyah.sh; do
  [ -f "$entry" ] && bash -n "$entry" 2>/dev/null && ok "entry point ok: $(basename "$entry")" || bad "$entry broken/missing" "this is a front door — restore it"
done

# ── 4. ENV — the keys to open the doors (never printed) ─────────────────────
h "ENV (secrets stay secret)"
if [ -f .env ]; then
  ok ".env present"
  for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
    if grep -qE "^${key}=.+" .env 2>/dev/null; then ok "$key set"
    else bad "$key missing/empty in .env" "add it (see .env.example) — app won't run without it"; fi
  done
else
  bad ".env missing" "cp .env.example .env  → fill in your Supabase keys"
fi
[ -f .env.example ] && ok ".env.example present (the template)" || warn ".env.example missing" "operators have nothing to copy from"

# ── 5. DEPENDENCIES — installed and buildable ───────────────────────────────
h "DEPENDENCIES"
if [ -d node_modules ]; then ok "node_modules installed"
else bad "node_modules missing" "run: npm install"; fi
[ -f package-lock.json ] && ok "lockfile present (reproducible installs)" || warn "no package-lock.json" "commit one for identical installs everywhere"

# ── VERDICT ─────────────────────────────────────────────────────────────────
printf "\n\033[1m── VERDICT ──\033[0m\n"
printf "  \033[32m%s pass\033[0m · \033[33m%s warn\033[0m · \033[31m%s fail\033[0m\n" "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf "  \033[42;30m READY TO OPEN \033[0m everything plug-and-play. boot with: \033[1mbash scripts/booyah.sh\033[0m\n"
  exit 0
else
  printf "  \033[41;97m NOT READY \033[0m fix the ✗ above (in order), then re-run \033[1mbash scripts/doctor.sh\033[0m\n"
  exit 1
fi
