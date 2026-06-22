#!/usr/bin/env bash
# Dual Setup Sync — doctor (registry + DB + mesh hints)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0
warn() { printf 'WARN  %s\n' "$*"; }
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAIL=1; }

echo "=== Dual Setup Sync doctor ==="

if python3 "$ROOT/scripts/dual-sync/registry.py" validate 2>/dev/null; then
  pass "registry validate"
else
  fail "registry validate"
fi

python3 "$ROOT/scripts/dual-sync/schema.py" --status 2>/dev/null || fail "sync DB"

if [[ -f "$ROOT/config/dual-sync.registry.local.yaml" ]]; then
  pass "local registry exists"
else
  warn "no dual-sync.registry.local.yaml — using example (placeholders)"
fi

if [[ -f "$ROOT/.swarm/machine" ]]; then
  pass "mesh identity: $(cat "$ROOT/.swarm/machine" 2>/dev/null || echo '?')"
else
  warn "no .swarm/machine — run scripts/swarm-join.sh on this device"
fi

if command -v tailscale >/dev/null 2>&1; then
  if tailscale status >/dev/null 2>&1; then
    pass "tailscale up"
  else
    warn "tailscale installed but not connected"
  fi
else
  warn "tailscale not installed"
fi

if [[ -x "$ROOT/scripts/hailmary" ]]; then
  pass "hailmary script present"
else
  warn "scripts/hailmary missing"
fi

echo ""
python3 "$ROOT/scripts/dual-sync/registry.py" status 2>/dev/null || true

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Result: PASS (warnings OK)"
  exit 0
else
  echo "Result: FAIL"
  exit 1
fi
