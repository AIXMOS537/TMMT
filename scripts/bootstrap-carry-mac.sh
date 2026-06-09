#!/usr/bin/env bash
# Carry-Mac bootstrap — uses a "key" flashdrive (holding the owner's .env) to set
# this repo up for development in ONE command.
#
# The flashdrive IS the key: it carries secrets/.env. Keep it physically secure,
# and NEVER hand a key-flashdrive to an operator — operator kits are zero-secret
# (see docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md).
#
# Usage:
#   bash scripts/bootstrap-carry-mac.sh [/Volumes/YOUR-KEY]
# With no path, it scans /Volumes for a drive that has secrets/.env (or .env).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚗  Carry-Mac bootstrap for TMMT"

# 1. Locate the key flashdrive --------------------------------------------------
KEY="${1:-}"
if [[ -z "$KEY" ]]; then
  for v in /Volumes/*; do
    [[ -d "$v" ]] || continue
    if [[ -f "$v/secrets/.env" || -f "$v/.env" ]]; then KEY="$v"; break; fi
  done
fi
if [[ -z "$KEY" ]]; then
  echo "✗ No key flashdrive found."
  echo "  Plug in the key drive, or pass its path:"
  echo "    bash scripts/bootstrap-carry-mac.sh /Volumes/YOUR-KEY"
  exit 1
fi

# 2. Find the .env on the key ---------------------------------------------------
ENV_SRC=""
for cand in "$KEY/secrets/.env" "$KEY/.env" "$KEY/tmmt/.env"; do
  [[ -f "$cand" ]] && { ENV_SRC="$cand"; break; }
done
[[ -n "$ENV_SRC" ]] || { echo "✗ No .env found on $KEY (looked in secrets/.env, .env, tmmt/.env)."; exit 1; }
echo "🔑  Key: $ENV_SRC"

# 3. Install the .env (back up any existing) ------------------------------------
if [[ -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env" "$ROOT/.env.backup.$(date +%s)"
  echo "   backed up existing .env"
fi
cp "$ENV_SRC" "$ROOT/.env"
echo "✓  .env installed into the repo"

# 4. Install dependencies -------------------------------------------------------
echo "→  npm install …"
( cd "$ROOT" && npm install )

# 5. Validate the env -----------------------------------------------------------
echo "→  validating env (npm run check-env) …"
( cd "$ROOT" && npm run check-env ) || echo "⚠  check-env reported issues — review your .env"

cat <<'DONE'

✅  Carry-Mac is ready.
   npm run dev      → http://localhost:3000
   npm test         → unit tests
   npm run build    → production build (primary gate)

   Start here for what's left:
   • docs/ACTION-CHECKLIST.md     (prioritized to-do, owner-tagged)
   • docs/QA-WALKTHROUGH.md       (page-by-page QA)
   • docs/HIGH-TICKET-GO-LIVE.md  (turn on payments)
DONE
