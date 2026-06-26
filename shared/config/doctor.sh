#!/usr/bin/env bash
#
# shared/config/doctor.sh — preflight check. Confirms your stack is reachable
# before Claude Code starts building. Reads from .env if present. Non-destructive.
#
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -f "$ROOT/.env" ] && set -a && . "$ROOT/.env" && set +a

ok(){ printf "  \033[32m✓\033[0m %s\n" "$1"; }
no(){ printf "  \033[31m✗\033[0m %s\n" "$1"; }
sk(){ printf "  \033[33m–\033[0m %s\n" "$1"; }

check_http(){ # name url
  local name="$1" url="$2"
  [ -z "$url" ] && { sk "$name (no URL set in .env)"; return; }
  if curl -fsS -m 5 -o /dev/null "$url" 2>/dev/null; then ok "$name reachable ($url)"; else no "$name NOT reachable ($url)"; fi
}

echo "AIXMOS preflight doctor"
echo ""
echo "Core services:"
check_http "Ollama"   "${OLLAMA_HOST:-http://localhost:11434}"
check_http "Qdrant"   "${QDRANT_URL:-}"
check_http "Supabase" "${SUPABASE_URL:-}"
check_http "Cloudflare gateway" "${CLOUDFLARE_GATEWAY_URL:-}"

echo ""
echo "Redis:"
if command -v redis-cli >/dev/null 2>&1 && [ -n "${REDIS_URL:-}" ]; then
  if redis-cli -u "$REDIS_URL" ping 2>/dev/null | grep -qi pong; then ok "Redis PONG"; else no "Redis not responding"; fi
else sk "Redis (redis-cli or REDIS_URL missing)"; fi

echo ""
echo "Credentials present (not validated, just set):"
for k in AIRTABLE_API_KEY STRIPE_SECRET_KEY GHL_API_KEY TWILIO_ACCOUNT_SID QUICKBOOKS_CLIENT_ID; do
  v="${!k:-}"; [ -n "$v" ] && ok "$k set" || sk "$k not set"
done

echo ""
echo "Tooling:"
for t in node python3 git curl; do
  command -v "$t" >/dev/null 2>&1 && ok "$t $( "$t" --version 2>/dev/null | head -1 )" || no "$t missing"
done

echo ""
echo "Compliance posture:"
python3 "$ROOT/shared/compliance-gates/check.py" 2>/dev/null && ok "posture check ran" || no "posture check failed — review gates"

echo ""
echo "Doctor complete. Fix ✗ items before building paths that need them. – means optional/unset."
