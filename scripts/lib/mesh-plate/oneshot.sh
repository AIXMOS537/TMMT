#!/usr/bin/env bash
# oneshot.sh — NEVER git-checkout scripts/
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
[[ -x "$ROOT/scripts/lib/mesh-plate-restore.sh" ]] && bash "$ROOT/scripts/lib/mesh-plate-restore.sh" 2>/dev/null || true
[[ -x "$ROOT/scripts/lib/install-oneshot-bin.sh" ]] && bash "$ROOT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
[[ -x "$ROOT/scripts/fleet-up.sh" ]] && bash "$ROOT/scripts/fleet-up.sh" 2>/dev/null || true
exec bash "$ROOT/scripts/serve.sh" owner
