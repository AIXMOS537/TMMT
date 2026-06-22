#!/usr/bin/env bash
# swarm-doctor — readiness + security audit for a machine on the mesh.
# Re-runnable any time. Prints PASS / WARN / FAIL and a final verdict.
#   bash scripts/swarm-doctor.sh            # full audit
#   bash scripts/swarm-doctor.sh --quick    # skip the deep gitleaks history scan
set -uo pipefail
source "$(dirname "$0")/lib/swarm-common.sh"
cd "$SWARM_ROOT"

QUICK=0; [[ "${1:-}" == "--quick" ]] && QUICK=1
PASS=0; WARN=0; FAILN=0
pass() { printf '  %sPASS%s %s\n' "$GRN" "$RST" "$*"; PASS=$((PASS+1)); }
wrn()  { printf '  %sWARN%s %s\n' "$YLW" "$RST" "$*"; WARN=$((WARN+1)); }
fl()   { printf '  %sFAIL%s %s\n' "$RED" "$RST" "$*"; FAILN=$((FAILN+1)); }

say "${BOLD}=== swarm-doctor — $(swarm_machine) (os: $(swarm_os)) ===${RST}"

say "${BOLD}Tooling${RST}"
for c in git node npm; do
  command -v "$c" >/dev/null 2>&1 && pass "$c present ($("$c" --version 2>/dev/null | head -1))" || fl "$c missing"
done
command -v claude >/dev/null 2>&1 && pass "claude CLI present" || fl "claude CLI missing (install + login)"
if command -v tmux >/dev/null 2>&1; then pass "tmux present"
elif [[ "$(swarm_os)" == "windows" ]] && command -v wt.exe >/dev/null 2>&1; then pass "Windows Terminal present (wt.exe)"
else wrn "no tmux / Windows Terminal — agents will use SWARM_LAUNCH=print"; fi
command -v gitleaks >/dev/null 2>&1 && pass "gitleaks present (deep secret scanning on)" \
  || wrn "gitleaks not installed — using built-in pattern guard only (recommend: brew install gitleaks)"

say "${BOLD}Repo & identity${RST}"
remote="$(git remote get-url origin 2>/dev/null || echo none)"
case "$remote" in *AIXMOS537/TMMT*|*Metavibez4L/TMMT*) pass "origin is the TMMT repo";; none) fl "no 'origin' remote";; *) wrn "origin is unexpected: $remote";; esac
git ls-remote origin -h HEAD >/dev/null 2>&1 && pass "git auth to origin works (read)" || fl "cannot reach origin — check auth (gh auth login / SSH / PAT)"
[[ -f "$SWARM_ROOT/.swarm/machine" || -n "${SWARM_MACHINE:-}" ]] && pass "machine name set ($(swarm_machine))" || wrn "machine name not set — run scripts/swarm-join.sh"
gu="$(git config user.email 2>/dev/null || true)"
[[ -n "$gu" ]] && pass "git commit identity set ($gu)" || wrn "git user.email not set in this repo — set per account (multi-account hygiene)"
# Unsafe location: a repo in the Trash, a temp dir, or a removable volume is one
# click (or one reboot) from losing everything — including the restored .env.
case "$SWARM_ROOT" in
  *.Trash/*|*/.Trash|*/Trash/*) fl "repo is in the TRASH ($SWARM_ROOT) — emptying trash deletes it + your .env. Move it: mv \"$SWARM_ROOT\" ~/projects/TMMT";;
  /tmp/*|/private/tmp/*|/var/tmp/*|/private/var/folders/*) fl "repo is in a TEMP dir ($SWARM_ROOT) — wiped on reboot. Move it: mv \"$SWARM_ROOT\" ~/projects/TMMT";;
  /Volumes/*|/media/*|/mnt/*|/run/media/*) wrn "repo is on a removable/mounted volume ($SWARM_ROOT) — unplugging it cuts the brain. A local path (~/projects/TMMT) is safer.";;
  *) pass "repo location is safe ($SWARM_ROOT)";;
esac

say "${BOLD}Secret hygiene${RST}"
if git check-ignore -q .env 2>/dev/null || grep -qE '^\.env' .gitignore 2>/dev/null; then pass ".env is git-ignored"; else fl ".env is NOT git-ignored — add '.env*' to .gitignore NOW"; fi
tracked="$(git ls-files | grep -Ei '(^|/)\.env(\.|$)|\.pem$|\.p12$|(^|/)id_(rsa|ed25519)$' | grep -v '\.example$' || true)"
[[ -z "$tracked" ]] && pass "no secret files tracked in git" || { fl "secret file(s) tracked: $tracked"; }
staged_secret="$(git diff --cached -U0 --no-color 2>/dev/null | grep -E '^\+' | grep -E 'SERVICE_ROLE_KEY[[:space:]]*=|WEBHOOK_SECRET[[:space:]]*=|-----BEGIN [A-Z ]*PRIVATE KEY-----' || true)"
[[ -z "$staged_secret" ]] && pass "nothing secret currently staged" || fl "a staged change looks like a secret — unstage it"
if [[ -f "$SWARM_ROOT/.env" ]]; then
  pass ".env present (agents can build)"
  if [[ "$(swarm_os)" != "windows" ]]; then
    perm="$(stat -f '%Lp' "$SWARM_ROOT/.env" 2>/dev/null || stat -c '%a' "$SWARM_ROOT/.env" 2>/dev/null || echo '')"
    case "$perm" in 600|400) pass ".env permissions are tight ($perm)";; "" ) wrn "could not read .env permissions";; *) wrn ".env is $perm — tighten: chmod 600 .env";; esac
  fi
else
  wrn ".env missing — agents can't build until it's restored (key flashdrive: scripts/bootstrap-carry-mac.sh)"
fi

say "${BOLD}Guardrails${RST}"
hp="$(git config core.hooksPath 2>/dev/null || true)"
[[ "$hp" == "scripts/hooks" ]] && pass "secret-guard hooks installed (core.hooksPath=scripts/hooks)" \
  || wrn "git hooks not installed — run scripts/swarm-join.sh (or: git config core.hooksPath scripts/hooks)"
[[ -x "$SWARM_ROOT/scripts/hooks/pre-commit" ]] && pass "pre-commit hook executable" || wrn "pre-commit hook not executable"

if [[ $QUICK -eq 0 ]] && command -v gitleaks >/dev/null 2>&1; then
  say "${BOLD}Deep scan${RST}"
  if gitleaks detect --no-banner --redact >/dev/null 2>&1; then pass "gitleaks history scan clean"; else fl "gitleaks found a secret in history — rotate + scrub"; fi
fi

say ""
say "${BOLD}Verdict:${RST} ${GRN}${PASS} pass${RST}, ${YLW}${WARN} warn${RST}, ${RED}${FAILN} fail${RST}"
[[ $FAILN -eq 0 ]] || { say "${RED}Resolve FAILs before running the swarm on this machine.${RST}"; exit 1; }
say "Reminder (owner, GitHub UI): branch protection on master, 2FA on every account, Secret Scanning + Push Protection ON. See docs/ACTION-CHECKLIST.md §A."
exit 0
