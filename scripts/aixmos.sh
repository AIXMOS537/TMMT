#!/usr/bin/env bash
#
# aixmos — single command surface to run the operation locally.
# ---------------------------------------------------------------------------
# Wraps the local-first toolchain so the whole business runs from one CLI.
# Everything is local, dry-run-safe, and never pushes on its own.
#
#   aixmos doctor      health-check: prerequisites + repo + router + open work
#   aixmos brief       daily brief: branch, uncommitted, open handoffs, last verify
#   aixmos verify ...  run the fact-check gate (scripts/verify-gate.sh passthrough)
#   aixmos handoff ... emit a mesh handoff      (scripts/mesh-handoff.sh passthrough)
#   aixmos legacy  ... build the Legacy edition (scripts/build-projectaixmos-legacy.sh)
#   aixmos hooks       install the pre-push gate (git core.hooksPath -> .githooks)
#   aixmos scan        inventory secrets in this repo (secret-scan.sh)
#   aixmos integrity   compromise scan THIS device (ssh/persistence/ports/hosts)
#   aixmos presence    mesh presence board (last-seen for every device)
#   aixmos beat        record THIS device's heartbeat now
#   aixmos where       YOU ARE HERE: env (DEV/TEST/PROD) + branch + path guard
#   aixmos onboard     mission-gated onboarding interview (operator/dev/vendor)
#   aixmos accounts    discover your accounts from browsers (site list, no passwords)
#   aixmos harden      guided 1-by-1 password/MFA hardening tracker
#   aixmos help
#
# Tip: add the repo's scripts/ to PATH, or alias:  alias aixmos='bash scripts/aixmos.sh'
# ---------------------------------------------------------------------------
set -uo pipefail

bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
bad(){ printf "\033[31m✗\033[0m %s\n" "$1"; }
warn(){ printf "\033[33m!\033[0m %s\n" "$1"; }
dim(){ printf "\033[2m%s\033[0m\n" "$1"; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"
S="$ROOT/scripts"
cmd="${1:-help}"; shift || true

have(){ command -v "$1" >/dev/null 2>&1; }

doctor(){
  bold "== aixmos doctor =="
  for t in git node npm; do have "$t" && ok "$t $("$t" --version 2>/dev/null | head -1)" || bad "$t MISSING"; done
  have tailscale && ok "tailscale present" || warn "tailscale not on this host (ok if not a node)"
  for f in verify-gate.sh mesh-handoff.sh build-projectaixmos-legacy.sh; do
    [ -x "$S/$f" ] && ok "scripts/$f" || bad "scripts/$f missing or not executable"
  done
  # router reachability (local-first AI)
  if [ -n "${LITELLM_BASE:-}" ]; then
    if curl -sS -m 3 "${LITELLM_BASE%/v1}/health" >/dev/null 2>&1 || curl -sS -m 3 "$LITELLM_BASE/models" >/dev/null 2>&1; then
      ok "router reachable: $LITELLM_BASE"
    else warn "LITELLM_BASE set but unreachable: $LITELLM_BASE"; fi
  else warn "LITELLM_BASE unset — verify-gate runs in report-only mode"; fi
  # git hook wired?
  [ "$(git config --get core.hooksPath || true)" = ".githooks" ] && ok "pre-push gate installed" || warn "pre-push gate NOT installed (run: aixmos hooks)"
  bold "Backstops you still own (by design): see docs/OPERATOR-RUNBOOK.md §2"
}

brief(){
  bold "== aixmos brief  ($(date -u +%Y-%m-%dT%H:%MZ)) =="
  echo "branch:   $(git branch --show-current)"
  local dirty; dirty="$(git status --porcelain | wc -l | tr -d ' ')"
  [ "$dirty" = 0 ] && ok "working tree clean" || warn "$dirty uncommitted change(s)"
  echo; bold "Open handoffs (your inbox):"
  git branch -a --list '*handoff/*' 2>/dev/null | sed 's/^/  /' | grep . || dim "  (none)"
  echo; bold "Last verify result:"
  if [ -f .aixmos/verify-log.ndjson ]; then tail -1 .aixmos/verify-log.ndjson | sed 's/^/  /'; else dim "  (gate not run yet)"; fi
  echo; bold "Commits today:"
  git log --since=midnight --oneline 2>/dev/null | sed 's/^/  /' | grep . || dim "  (none yet)"
}

install_hooks(){
  mkdir -p "$ROOT/.githooks"
  git config core.hooksPath .githooks
  ok "core.hooksPath -> .githooks  (pre-push gate active)"
  dim "Bypass once (emergencies): git push --no-verify"
}

case "$cmd" in
  doctor)  doctor;;
  brief)   brief;;
  verify)  exec bash "$S/verify-gate.sh" "$@";;
  handoff) exec bash "$S/mesh-handoff.sh" "$@";;
  legacy)  exec bash "$S/build-projectaixmos-legacy.sh" "$@";;
  hooks)   install_hooks;;
  scan)    exec bash "$S/secret-scan.sh" "$@";;
  integrity) exec bash "$S/device-integrity.sh" "$@";;
  presence) exec bash "$S/heartbeat.sh" "${1:-status}";;
  beat)    exec bash "$S/heartbeat.sh" beat;;
  where|whereami) exec bash "$S/whereami.sh";;
  onboard) exec bash "$S/onboard-interview.sh" "$@";;
  harden)  exec bash "$S/account-hardening.sh" "$@";;
  accounts) exec bash "$S/account-discover.sh" "$@";;
  help|-h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) bad "unknown command: $cmd"; echo "try: aixmos help"; exit 2;;
esac
