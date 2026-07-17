#!/usr/bin/env bash
# Production Next.js server for office Mac spine (Tailscale: http://<tailscale-host>:3000)
# Runs `next start` against a prebuilt .next. Fast crash-recovery: only builds if no
# build artifact exists. Deploys/rebuilds are handled by office-prod-deploy.sh.

set -euo pipefail

REPO_ROOT="${TMMT_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
OS_DIR="${REPO_ROOT}/tmmt-os"
PORT="${TMMT_PROD_PORT:-3000}"
LOG_TAG="[tmmt-prod $(date -Iseconds)]"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"
export NODE_ENV=production

cd "$OS_DIR"

if [[ ! -f .env.local ]]; then
  echo "${LOG_TAG} ERROR: missing ${OS_DIR}/.env.local"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "${LOG_TAG} Installing dependencies (npm ci)..."
  npm ci
fi

# Only build if there is no production artifact (e.g. first boot). Normal deploys
# rebuild via office-prod-deploy.sh, so crash-restarts here stay fast.
if [[ ! -f .next/BUILD_ID ]]; then
  echo "${LOG_TAG} No production build found — building..."
  npm run build
fi

echo "${LOG_TAG} Starting Next.js (production) on 127.0.0.1:${PORT}"
exec npm run start -- --hostname 127.0.0.1 --port "$PORT"
