#!/usr/bin/env bash
# deal.sh — GET PAID wizard. Owner crumbs only; agents do the rest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMMT_CFG="${HOME}/.config/tmmt"
mkdir -p "$TMMT_CFG"
PASTE_FILE="$TMMT_CFG/ghl-paste.env"
ENV_LOCAL="$ROOT/.env.local"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
dim() { printf '\033[2m%s\033[0m\n' "$*"; }

merge_env_key() {
  local key="$1" val="$2" file="$3"
  [[ -z "$val" ]] && return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$file"
    fi
  else
    printf '\n%s=%s\n' "$key" "$val" >>"$file"
  fi
}

ensure_webhook_secret() {
  local current=""
  if [[ -f "$ENV_LOCAL" ]]; then
    current="$(grep '^GHL_WEBHOOK_SECRET=' "$ENV_LOCAL" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
  fi
  if [[ -n "$current" && ${#current} -ge 16 ]]; then
    echo "$current"
    return 0
  fi
  local secret
  secret="$(openssl rand -hex 24)"
  touch "$ENV_LOCAL"
  merge_env_key "GHL_WEBHOOK_SECRET" "$secret" "$ENV_LOCAL"
  merge_env_key "GHL_WEBHOOK_SECRET" "$secret" "$ROOT/.env"
  echo "$secret"
}

print_header() {
  bold "╔══════════════════════════════════════════════════════════════╗"
  bold "║  TMMT GET PAID — owner crumbs (5–15 min in GHL UI)           ║"
  bold "╚══════════════════════════════════════════════════════════════╝"
  echo ""
}

print_crumb_checklist() {
  local secret="$1"
  dim "Webhook endpoint (paste into GHL workflow):"
  echo "  POST https://tmmt-ops.vercel.app/api/webhooks/ghl"
  echo "  Header: x-ghl-webhook-secret: $secret"
  echo ""
  bold "Paste these checkout URLs into GHL → Products → copy funnel links:"
  echo "  P0 — Ops Kit          → NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT"
  echo "  P0 — Command Kit      → NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT"
  echo "  P0 — Dealer bundle    → NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE"
  echo "  P0 — \$97 membership   → NEXT_PUBLIC_GHL_CHECKOUT_97"
  echo "  P0 — Upsell pipeline  → NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL"
  echo ""
  bold "Fast paste file (one key=url per line, then re-run: x --money apply):"
  echo "  $PASTE_FILE"
  echo ""
  bold "When pasted:"
  echo "  x --money apply     # merge paste file → .env.local"
  echo "  npm run ghl:sync-vercel"
  echo "  bash scripts/ship tmmt-ops"
  echo "  npm run ghl:check"
}

apply_paste_file() {
  if [[ ! -f "$PASTE_FILE" ]]; then
    echo "No paste file at $PASTE_FILE" >&2
    echo "Create it with lines like: NEXT_PUBLIC_GHL_CHECKOUT_97=https://..." >&2
    exit 1
  fi
  touch "$ENV_LOCAL"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" || "$line" != *"="* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    merge_env_key "$key" "$val" "$ENV_LOCAL"
    merge_env_key "$key" "$val" "$ROOT/.env"
    echo "✓ $key"
  done <"$PASTE_FILE"
  echo ""
  npm run ghl:check || true
}

open_ghl_docs() {
  if [[ -f "$ROOT/docs/GHL-WEBHOOK-SETUP.md" ]]; then
    dim "Full webhook doc: docs/GHL-WEBHOOK-SETUP.md"
  fi
  if command -v open >/dev/null 2>&1; then
    open "https://app.gohighlevel.com/" 2>/dev/null || true
  fi
}

case "${1:-summary}" in
  summary|""|status)
    print_header
    secret="$(ensure_webhook_secret)"
    bold "✓ GHL_WEBHOOK_SECRET generated and saved to .env.local"
    echo ""
    npm run ghl:check 2>/dev/null || true
    echo ""
    print_crumb_checklist "$secret"
    open_ghl_docs
    ;;
  apply|sync)
    print_header
    apply_paste_file
    ;;
  watch)
    print_header
    exec bash "$ROOT/scripts/ghl-paste-watch.sh"
    ;;
  open|ghl)
    open_ghl_docs
    ;;
  help|-h|--help)
    cat <<'HELP'
x --money          Show blockers + webhook secret + crumb checklist
x --money apply    Merge ~/.config/tmmt/ghl-paste.env → .env.local
x --money open     Open GHL in browser
HELP
    ;;
  *)
    echo "Unknown: deal.sh $1 — try: x --money" >&2
    exit 1
    ;;
esac
