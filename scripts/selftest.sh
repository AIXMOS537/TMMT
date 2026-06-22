#!/usr/bin/env bash
# selftest — stress the command surface so it won't crack when the moment's too big.
# Proves the scripts DEGRADE GRACEFULLY (missing tools, no network, junk args, DARK on)
# instead of crashing. Read-only / dry only: never launches agents, binds the network,
# or touches prod. Run anywhere.
#
#   bash scripts/selftest.sh           shell stress tests
#   bash scripts/selftest.sh --full    also run the app gates (build · test · lint)
#   bash scripts/tmmt selftest
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; R=; Y=; BD=; X=; fi
PASS=0; FAIL=0; FAILED=()

# crash = a bash-level failure (not a clean, intentional non-zero exit)
crashed(){ echo "$1" | grep -qiE "unbound variable|: syntax error|: line [0-9]+: .*(unexpected|not found)|integer expression expected|bad substitution"; }

check(){ # check <name> <want-exit|any> <cmd...>
  local name="$1" want="$2"; shift 2
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if crashed "$out"; then
    printf '%s✗ %s — CRASHED%s\n' "$R" "$name" "$X"; echo "$out" | grep -iE "unbound|syntax|line [0-9]+" | head -2 | sed 's/^/      /'
    FAIL=$((FAIL+1)); FAILED+=("$name"); return
  fi
  if [ "$want" = any ] || [ "$rc" = "$want" ]; then
    printf '%s✓ %s%s (exit %s)\n' "$G" "$name" "$X" "$rc"; PASS=$((PASS+1))
  else
    printf '%s✗ %s — exit %s, wanted %s%s\n' "$R" "$name" "$rc" "$want" "$X"; FAIL=$((FAIL+1)); FAILED+=("$name")
  fi
}

# Ensure DARK is restored to its prior state no matter what.
DARK_PRE=0; [ -f "$ROOT/.swarm/DARK" ] && DARK_PRE=1
cleanup(){ if [ "$DARK_PRE" = 0 ]; then rm -f "$ROOT/.swarm/DARK"; fi; }
trap cleanup EXIT

echo "${BD}── 1) Syntax: every shell script ──${X}"
synfail=0
while IFS= read -r f; do bash -n "$f" 2>/dev/null || { printf '%s✗ syntax: %s%s\n' "$R" "$f" "$X"; synfail=1; FAIL=$((FAIL+1)); }; done \
  < <(find "$ROOT/scripts" -name "*.sh" 2>/dev/null; printf '%s\n' "$ROOT/scripts/tmmt" "$ROOT/scripts/hailmary" "$ROOT/scripts/ceo")
[ "$synfail" = 0 ] && { printf '%s✓ all parse clean%s\n' "$G" "$X"; PASS=$((PASS+1)); }

echo "${BD}── 2) Safe paths degrade (don't crash) ──${X}"
check "parity status"            any bash "$ROOT/scripts/parity.sh" status
check "parity (no arg → help)"   any bash "$ROOT/scripts/parity.sh"
check "parity doctor"            any bash "$ROOT/scripts/parity.sh" doctor
check "fanout dry"               0   bash "$ROOT/scripts/fanout.sh" 3 --dry
check "cursor-hailmary verify"   any bash "$ROOT/scripts/cursor-hailmary.sh"
check "brain-router (no litellm)" any bash "$ROOT/scripts/brain-router.sh"
check "setup-llm serve (no ollama)" any bash "$ROOT/scripts/setup-llm.sh" serve
check "local-up down (nothing)"  0   bash "$ROOT/scripts/local-up.sh" down
check "tmmt no-arg (words)"      any bash "$ROOT/scripts/tmmt"
check "tmmt unknown verb"        any bash "$ROOT/scripts/tmmt" zzznotaverb

echo "${BD}── 3) Junk-arg robustness (no crash on garbage) ──${X}"
check "fanout junk N"            0   bash "$ROOT/scripts/fanout.sh" banana --dry
check "fanout neg/odd"           0   bash "$ROOT/scripts/fanout.sh" -- --dry

echo "${BD}── 4) DARK kill-switch is honored ──${X}"
mkdir -p "$ROOT/.swarm"; : > "$ROOT/.swarm/DARK"
check "DARK blocks fanout"       1   bash "$ROOT/scripts/fanout.sh" --dry
check "DARK blocks brain-router" 1   bash "$ROOT/scripts/brain-router.sh"
check "DARK blocks tmmt verb"    1   bash "$ROOT/scripts/tmmt" fanout --dry
cleanup; DARK_PRE=0  # already restored

if [ "${1:-}" = "--full" ]; then
  echo "${BD}── 5) App gates ──${X}"
  check "build"  0 bash -c "npm run build >/dev/null 2>&1"
  check "vitest" 0 bash -c "npx vitest run >/dev/null 2>&1"
  check "eslint" 0 bash -c "npx eslint src >/dev/null 2>&1"
fi

echo
if [ "$FAIL" = 0 ]; then
  printf '%s%s🛡️  HELD THE LINE — %s checks passed, 0 failed. Won'\''t fold.%s\n' "$BD" "$G" "$PASS" "$X"
else
  printf '%s%s✗ %s FAILED (%s passed): %s%s\n' "$BD" "$R" "$FAIL" "$PASS" "${FAILED[*]}" "$X"; exit 1
fi
