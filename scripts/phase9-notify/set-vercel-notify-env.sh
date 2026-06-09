#!/usr/bin/env bash
# Phase 9 — wire notification env vars into Vercel tmmt-ops and redeploy.
# Run on the Mac (or any machine with the vercel CLI logged in).
# Variables can be passed via env vars (recommended — avoids shell history leaks) OR positional args.
#
# Usage:
#   SLACK_WEBHOOK_URL=... TELEGRAM_BOT_TOKEN=... TELEGRAM_OWNER_CHAT_ID=... \
#   IMESSAGE_RELAY_URL=... IMESSAGE_NOTIFY_TO=... \
#   ./set-vercel-notify-env.sh
#
# Leave any variable blank to skip wiring that channel.
# All vars are written to production + preview + development scopes.
# Idempotent: existing keys are removed first, then re-added.

set -euo pipefail

PROJECT="tmmt-ops"
ENVS=("production" "preview" "development")

# Find repo root and cd in so vercel CLI picks up the right project link.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

require_vercel() {
  if ! command -v vercel >/dev/null 2>&1; then
    echo "ERROR: vercel CLI not found. Install: npm i -g vercel" >&2
    exit 1
  fi
  if ! vercel whoami >/dev/null 2>&1; then
    echo "ERROR: not logged in. Run: vercel login" >&2
    exit 1
  fi
}

set_env_var() {
  local key="$1"
  local value="$2"
  if [ -z "${value}" ]; then
    echo "  skip ${key} (empty)"
    return 0
  fi
  for scope in "${ENVS[@]}"; do
    # Remove if present (ignore failure — key may not exist yet)
    vercel env rm "${key}" "${scope}" --yes --scope aixmos537 >/dev/null 2>&1 || true
    # Add new value
    printf '%s' "${value}" | vercel env add "${key}" "${scope}" --scope aixmos537 >/dev/null
    echo "  set ${key} (${scope})"
  done
}

main() {
  require_vercel

  echo "==> wiring notification env vars to ${PROJECT}"
  set_env_var "SLACK_WEBHOOK_URL"       "${SLACK_WEBHOOK_URL:-}"
  set_env_var "TELEGRAM_BOT_TOKEN"      "${TELEGRAM_BOT_TOKEN:-}"
  set_env_var "TELEGRAM_OWNER_CHAT_ID"  "${TELEGRAM_OWNER_CHAT_ID:-}"
  set_env_var "IMESSAGE_RELAY_URL"      "${IMESSAGE_RELAY_URL:-}"
  set_env_var "IMESSAGE_NOTIFY_TO"      "${IMESSAGE_NOTIFY_TO:-}"
  set_env_var "IMESSAGE_RELAY_TOKEN"    "${IMESSAGE_RELAY_TOKEN:-}"

  echo ""
  echo "==> triggering production deploy"
  vercel --prod --yes --scope aixmos537

  echo ""
  echo "==> done. Verify at: https://tmmt-ops.vercel.app/forms/credit-funding-intake"
  echo "    Then run: ./scripts/phase9-notify/smoke-test-handoff.sh"
}

main "$@"
