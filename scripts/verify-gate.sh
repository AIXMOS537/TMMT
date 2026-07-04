#!/usr/bin/env bash
#
# verify-gate.sh — local fact-check + auto-fix gate for ANY AI tool's output.
# ---------------------------------------------------------------------------
# Whatever produced the change (Claude Code, Cursor, Codex, a teammate) — this
# gate decides if it's real. Deterministic checks are the ground truth; a LOCAL
# model only fills the blanks (reads failures, proposes a patch, re-verify).
# Frontier models are touched ONLY if local can't close it.
#
# Flow:
#   1. Run the checks (build / types / lint / tests / integration).
#   2. All pass            → ✓ accept the work.
#   3. Fail + local router → ask the local `code` model for a unified-diff fix,
#                            (--apply) apply it, re-run. Loop up to MAX_ITERS.
#   4. Still failing        → (--escalate) try the frontier model once, else stop
#                            and hand a clean report to a human. NEVER pushes.
#
# Local-first: needs only bash + git + your checks. The LLM auto-fix is optional
# and uses your OpenAI-compatible router (LiteLLM) — see docs/LOCAL-FIRST-AI-STACK.md.
#
# Usage:
#   scripts/verify-gate.sh                 # run checks, report (no fixes)
#   scripts/verify-gate.sh --apply         # + let the local model patch & re-verify
#   scripts/verify-gate.sh --apply --escalate
#   LITELLM_BASE=http://hub:4000/v1 scripts/verify-gate.sh --apply
#   VERIFY_CHECKS=$'types|npx tsc --noEmit\nlint|npm run lint' scripts/verify-gate.sh
#
# Env: LITELLM_BASE (OpenAI-compatible /v1), LITELLM_KEY, MODEL_CODE (def "code"),
#      MODEL_ESCALATE (def "escalate"), MAX_ITERS (def 3).
# ---------------------------------------------------------------------------
set -uo pipefail   # not -e: we handle failures ourselves

bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
bad(){ printf "\033[31m✗\033[0m %s\n" "$1"; }
warn(){ printf "\033[33m!\033[0m %s\n" "$1"; }

APPLY=false; ESCALATE=false
for a in "$@"; do case "$a" in
  --apply) APPLY=true;; --escalate) ESCALATE=true;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) bad "unknown arg: $a"; exit 2;;
esac; done

MAX_ITERS=${MAX_ITERS:-3}
LITELLM_BASE=${LITELLM_BASE:-}
LITELLM_KEY=${LITELLM_KEY:-local}
MODEL_CODE=${MODEL_CODE:-code}
MODEL_ESCALATE=${MODEL_ESCALATE:-escalate}

command -v git >/dev/null || { bad "git required"; exit 2; }
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"
OUTDIR=".aixmos"; mkdir -p "$OUTDIR"
AUDIT="$OUTDIR/verify-log.ndjson"
ts(){ date -u +%Y-%m-%dT%H:%M:%SZ; }
log(){ printf '{"t":"%s","event":%s}\n' "$(ts)" "$1" >> "$AUDIT"; }

# ---- load checks: "name|command" lines (VERIFY_CHECKS env > verify.checks file > defaults)
declare -a CHECKS
if [ -n "${VERIFY_CHECKS:-}" ]; then
  while IFS= read -r line; do [ -n "$line" ] && CHECKS+=("$line"); done <<< "$VERIFY_CHECKS"
elif [ -f verify.checks ]; then
  while IFS= read -r line; do [[ -n "$line" && "$line" != \#* ]] && CHECKS+=("$line"); done < verify.checks
else
  CHECKS=( "build|npm run build" "lint|npm run lint" )   # project defaults (CLAUDE.md primary gate)
fi

run_checks(){   # returns count of failures; writes per-check logs
  local fails=0; LAST_FAILS=()
  for entry in "${CHECKS[@]}"; do
    local name="${entry%%|*}" cmd="${entry#*|}" logf="$OUTDIR/check-${entry%%|*}.log"
    printf "  • %-12s" "$name"
    if bash -c "$cmd" >"$logf" 2>&1; then printf "\033[32mPASS\033[0m\n"
    else printf "\033[31mFAIL\033[0m\n"; fails=$((fails+1)); LAST_FAILS+=("$name|$cmd|$logf"); fi
  done
  return $fails
}

# ---- local model call (OpenAI-compatible). Echoes content or empty on failure.
call_model(){
  local model="$1" sys="$2" user="$3"
  [ -n "$LITELLM_BASE" ] || return 1
  local payload resp
  payload=$(node -e 'process.stdout.write(JSON.stringify({model:process.argv[1],temperature:0.1,stream:false,messages:[{role:"system",content:process.argv[2]},{role:"user",content:process.argv[3]}]}))' "$model" "$sys" "$user") || return 1
  resp=$(curl -sS -m 180 "$LITELLM_BASE/chat/completions" -H "Content-Type: application/json" -H "Authorization: Bearer $LITELLM_KEY" -d "$payload") || return 1
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).choices?.[0]?.message?.content||"")}catch(e){}})' <<<"$resp"
}

FIX_SYS='You are a LOCAL fix agent. You are given failing check logs and the current git diff. Output ONLY a unified diff that `git apply` can apply (with a/ and b/ prefixes). No prose, no code fences. If you cannot fix it safely, output exactly: NOFIX.'

attempt_fix(){   # $1=model ; applies in --apply mode; returns 0 if a patch was applied
  local model="$1" failblob="" entry name logf
  for entry in "${LAST_FAILS[@]}"; do
    name="${entry%%|*}"; logf="${entry##*|}"
    failblob+=$'\n### FAILED: '"$name"$'\n'"$(tail -c 4000 "$logf")"$'\n'
  done
  local diff; diff="$(git --no-pager diff HEAD)"; [ -n "$diff" ] || diff="(no diff vs HEAD; change may be unstaged-new files)"
  local patch; patch="$(call_model "$model" "$FIX_SYS" "Repo: $(basename "$ROOT")
Failing checks:$failblob

Current diff vs HEAD:
$diff

Return ONLY a git-applyable unified diff that makes the checks pass.")"
  [ -n "$patch" ] && [ "$patch" != "NOFIX" ] || { warn "model returned no patch ($model)"; return 1; }
  echo "$patch" > "$OUTDIR/proposed.patch"
  if ! $APPLY; then warn "dry-run: proposed patch saved to $OUTDIR/proposed.patch (re-run with --apply)"; return 1; fi
  if git apply --recount "$OUTDIR/proposed.patch" 2>/dev/null || git apply --3way --recount "$OUTDIR/proposed.patch" 2>/dev/null; then
    ok "applied patch from $model"; log "{\"applied\":\"$model\"}"; return 0
  else warn "patch from $model did not apply cleanly"; return 1; fi
}

# ================= main loop =================
bold "== verify-gate ==  checks: ${#CHECKS[@]}  apply:$APPLY  escalate:$ESCALATE  router:${LITELLM_BASE:-none}"
iter=0
while :; do
  bold "Run $((iter+1)): checks"
  run_checks; fails=$?
  log "{\"run\":$((iter+1)),\"failures\":$fails}"
  if [ "$fails" -eq 0 ]; then ok "ALL CHECKS PASS — work accepted."; exit 0; fi
  bad "$fails check(s) failed."
  if [ -z "$LITELLM_BASE" ]; then
    warn "No local router (LITELLM_BASE unset) — can't auto-fill. Reported only."
    warn "Logs: $OUTDIR/check-*.log"; exit 1
  fi
  if [ "$iter" -ge "$MAX_ITERS" ]; then
    if $ESCALATE; then
      bold "Local exhausted after $MAX_ITERS — escalating to $MODEL_ESCALATE (frontier)…"
      attempt_fix "$MODEL_ESCALATE" && { iter=$((iter+1)); continue; }
    fi
    bad "Could not close it locally in $MAX_ITERS iterations. Handing to a human."; exit 1
  fi
  bold "Local fill-the-blanks with $MODEL_CODE (iter $((iter+1)))…"
  attempt_fix "$MODEL_CODE" || { $APPLY || exit 1; }   # dry-run stops after proposing
  iter=$((iter+1))
done
