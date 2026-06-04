#!/usr/bin/env bash
# Quick test: can this shell write to mounted TMMT flash volumes?
set -euo pipefail

ok=0
fail=0

for vol in AIXMOS02 LEXAR CYBORG AIX-CARRY AIX-HOME-PC AIX-INVESTORS; do
  [[ -d "/Volumes/${vol}" ]] || continue
  f="/Volumes/${vol}/.tmmt_write_test_$$"
  if echo "ok" >"$f" 2>/dev/null; then
    rm -f "$f"
    echo "OK   /Volumes/${vol}"
    ok=$((ok + 1))
  else
    echo "FAIL /Volumes/${vol} — grant Full Disk Access to /bin/bash (and Terminal)"
    fail=$((fail + 1))
  fi
done

if [[ "$ok" -eq 0 && "$fail" -eq 0 ]]; then
  echo "No TMMT flash volumes mounted."
  exit 2
fi

exit "$fail"
