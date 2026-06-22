#!/usr/bin/env bash
# doctor — friendly entry point for the readiness + security audit.
# The CEO brief / onboarding tell people to run "scripts/doctor.sh"; this is that
# file. It just runs the real audit (swarm-doctor.sh): PASS / WARN / FAIL + verdict.
#   bash scripts/doctor.sh           full audit
#   bash scripts/doctor.sh --quick   skip the deep history scan
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/swarm-doctor.sh" "$@"
