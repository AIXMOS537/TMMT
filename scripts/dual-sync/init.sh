#!/usr/bin/env bash
# Dual Setup Sync — one-shot init (owner | operator | sync)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-owner}"
ORG=""
MESH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    owner|operator|sync) MODE="$1"; shift ;;
    --org) ORG="$2"; shift 2 ;;
    --mesh) MESH="$2"; shift 2 ;;
    *) shift ;;
  esac
done

LOCAL_REG="$ROOT/config/dual-sync.registry.local.yaml"
EXAMPLE_REG="$ROOT/config/dual-sync.registry.example.yaml"
LOCAL_BROTHER="$ROOT/config/hailmary-brother.local.yaml"
EXAMPLE_BROTHER="$ROOT/config/hailmary-brother.example.yaml"

info() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }

info "Dual Setup Sync init — mode: $MODE"

python3 -c "import yaml" 2>/dev/null || python3 -m pip install pyyaml --user -q

if [[ ! -f "$LOCAL_REG" ]]; then
  cp "$EXAMPLE_REG" "$LOCAL_REG"
  ok "Created $LOCAL_REG — edit numbers before prod"
fi

case "$MODE" in
  owner)
    if [[ ! -f "$LOCAL_BROTHER" ]]; then
      cp "$EXAMPLE_BROTHER" "$LOCAL_BROTHER"
      ok "Created $LOCAL_BROTHER"
    fi
    info "Owner path: brain=brainiac-mac mobile=carry-mac"
    ;;
  operator)
    if [[ -z "$ORG" ]]; then
      echo "operator mode requires --org moe-legacy" >&2
      exit 1
    fi
    info "Operator path: org=$ORG (add principal block in registry if missing)"
    ;;
  sync)
    if [[ -z "$MESH" ]]; then
      echo "sync mode requires --mesh <mesh-name>" >&2
      exit 1
    fi
    if [[ -x "$ROOT/scripts/swarm-join.sh" ]]; then
      info "Run: bash scripts/swarm-join.sh --name $MESH"
    fi
    ;;
esac

python3 "$ROOT/scripts/dual-sync/registry.py" validate || exit 1
python3 "$ROOT/scripts/dual-sync/schema.py" --import-registry
python3 "$ROOT/scripts/dual-sync/upgrade.py"

ok "Dual Setup Sync initialized"
echo ""
echo "Next:"
case "$MODE" in
  owner)
    echo "  1. Edit config/dual-sync.registry.local.yaml (real numbers local only)"
    echo "  2. On brainiac-mac: bash scripts/hailmary booyah"
    echo "  3. bash scripts/setup-mac-imessage-bridge.sh"
    echo "  4. iPhone → Text Message Forwarding → brain ON"
    echo "  5. npm run dual-sync:doctor"
    ;;
  operator)
    echo "  1. Contract + payment → provision tenant seat"
    echo "  2. bash scripts/dual-sync/init.sh sync --mesh $MESH"
    echo "  3. Modules gated in registry — no owner-only modules"
    ;;
  sync)
    echo "  1. bash scripts/swarm-join.sh --name $MESH"
    echo "  2. npm run dual-sync:doctor"
    ;;
esac
