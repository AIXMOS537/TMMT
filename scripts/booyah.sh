#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -x "$ROOT/scripts/lib/install-oneshot-bin.sh" ]] && bash "$ROOT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
[[ -x "$ROOT/scripts/hailmary" ]] && bash "$ROOT/scripts/hailmary" booyah 2>/dev/null || true
export SERVE_SKIN=hailmary
exec bash "$ROOT/scripts/serve.sh" owner
