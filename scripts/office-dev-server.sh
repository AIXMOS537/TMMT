#!/usr/bin/env bash
# Always-on Next.js dev server for office Mac (Tailscale: http://<tailscale-host>:3000)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OS_DIR="${REPO_ROOT}/tmmt-os"
PORT="${TMMT_DEV_PORT:-3000}"
LOG_TAG="[tmmt-dev $(date -Iseconds)]"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

cd "$OS_DIR"

if [[ ! -f .env.local ]]; then
  echo "${LOG_TAG} ERROR: missing ${OS_DIR}/.env.local"
  exit 1
fi

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 2>/dev/null || fnm install
elif [[ -f "${REPO_ROOT}/.node-version" ]] && command -v mise >/dev/null 2>&1; then
  mise install -y
fi

if [[ ! -d node_modules ]]; then
  echo "${LOG_TAG} Installing dependencies (npm ci)..."
  npm ci
fi

echo "${LOG_TAG} Starting Next.js on 0.0.0.0:${PORT}"
exec npm run dev -- --hostname 0.0.0.0 --port "$PORT"
