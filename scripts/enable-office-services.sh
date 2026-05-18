#!/usr/bin/env bash
# Enable both office LaunchAgents (git pull + dev server). Run in Terminal.app.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

bash "${REPO_ROOT}/scripts/enable-office-autopull.sh"
bash "${REPO_ROOT}/scripts/enable-office-dev-server.sh"

echo ""
echo "Office services enabled: auto-pull + dev server."
