#!/usr/bin/env bash
# Add GHL_API_KEY to .env.local and Vercel production (never commit the key).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

echo "TMMT OS — GHL API key setup"
echo "Get your token: GHL → Settings → Private Integrations → Create"
echo "Scopes: contacts.readonly, contacts.write"
echo ""
read -rsp "Paste GHL_API_KEY (hidden): " API_KEY
echo ""

if [[ -z "${API_KEY// }" ]]; then
  echo "No key entered. Aborting."
  exit 1
fi

touch "$ENV_FILE"
if grep -q '^GHL_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  if [[ "$(uname)" == Darwin ]]; then
    sed -i '' "s|^GHL_API_KEY=.*|GHL_API_KEY=${API_KEY}|" "$ENV_FILE"
  else
    sed -i "s|^GHL_API_KEY=.*|GHL_API_KEY=${API_KEY}|" "$ENV_FILE"
  fi
else
  printf '\nGHL_API_KEY=%s\n' "$API_KEY" >> "$ENV_FILE"
fi
echo "Updated $ENV_FILE"

cd "$ROOT"
if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found. Install Node, then run: npx vercel env add GHL_API_KEY production"
  exit 0
fi

echo "Adding GHL_API_KEY to Vercel production..."
printf '%s' "$API_KEY" | npx vercel env add GHL_API_KEY production --force

read -rp "Redeploy production now? [y/N] " REDEPLOY
case "$REDEPLOY" in
  [yY]|[yY][eE][sS])
    npx vercel --prod
    echo "Done. Test: advance a case in TMMT OS, then check the contact in GHL."
    ;;
  *)
    echo "Skipped deploy. Run: npx vercel --prod"
    ;;
esac
