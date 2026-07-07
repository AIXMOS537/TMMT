#!/usr/bin/env bash
# agent-dispatch.sh — M1 WORK LAW entry: route all intake to Rick/forge.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$ROOT/scripts/mesh/m1-work-router.sh" route
