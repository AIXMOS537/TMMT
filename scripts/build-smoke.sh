#!/usr/bin/env bash
# build-smoke.sh — the one gate that never ran locally: `next build`.
#
# F-09 left `build` out of the pre-push set on purpose (it is the slow check and
# CI runs it on every PR). This wrapper puts it back WITHOUT making a low-RAM
# box unusable: it runs the production build only when the machine has room,
# and otherwise skips with a logged reason and exit 0 so the push still goes
# through. CI (.github/workflows/verify.yml) still builds unconditionally.
#
# Knobs:
#   BUILD_SMOKE=1        force the build regardless of free RAM
#   BUILD_SMOKE=0        force a skip (e.g. a docs-only push)
#   BUILD_SMOKE_MIN_MB   free-RAM floor in MB (default 8192)
#
# Free RAM is read from /proc/meminfo (Linux/WSL), `vm_stat` (macOS) or
# PowerShell (Git Bash on Windows). Unknown -> skip, never guess.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
MIN_MB="${BUILD_SMOKE_MIN_MB:-8192}"

free_mb() {
  local v=""
  # Linux / WSL. Git Bash (MSYS) also exposes /proc/meminfo but without
  # MemAvailable, so fall back to MemFree and then to PowerShell.
  if [ -r /proc/meminfo ]; then
    v="$(awk '/^MemAvailable:/ {printf "%d", $2/1024; exit}' /proc/meminfo 2>/dev/null)"
    [ -z "$v" ] && v="$(awk '/^MemFree:/ {printf "%d", $2/1024; exit}' /proc/meminfo 2>/dev/null)"
  fi
  # macOS
  if [ -z "$v" ] && command -v vm_stat >/dev/null 2>&1; then
    v="$(vm_stat | awk '/page size of/ {ps=$8} /Pages free|Pages inactive|Pages speculative/ {f+=$3} END {printf "%d", f*ps/1048576}')"
  fi
  # Windows (Git Bash): ask PowerShell for the real number.
  if [ -z "$v" ] && command -v powershell.exe >/dev/null 2>&1; then
    v="$(powershell.exe -NoProfile -Command '[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)' 2>/dev/null | tr -d '\r\n ')"
  fi
  case "$v" in ''|*[!0-9]*) echo "";; *) echo "$v";; esac
}

case "${BUILD_SMOKE:-}" in
  1) echo "build-smoke: BUILD_SMOKE=1, building";;
  0) echo "build-smoke: SKIP (BUILD_SMOKE=0)"; exit 0;;
  *)
    FREE="$(free_mb)"
    if [ -z "$FREE" ]; then echo "build-smoke: SKIP (could not read free RAM; CI still builds)"; exit 0; fi
    if [ "$FREE" -lt "$MIN_MB" ]; then
      echo "build-smoke: SKIP (free RAM ${FREE} MB < ${MIN_MB} MB; CI still builds; BUILD_SMOKE=1 to force)"
      exit 0
    fi
    echo "build-smoke: free RAM ${FREE} MB >= ${MIN_MB} MB, building";;
esac

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
npm run build
