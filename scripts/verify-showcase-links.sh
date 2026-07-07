#!/usr/bin/env bash
# verify-showcase-links.sh — test every outbound URL before it ships in showcase
set -euo pipefail

OUT="${1:-$HOME/Desktop/★ TEAM-UP-SHOWCASE/LINK-MANIFEST.json}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code final
  read -r code final < <(curl -sS -o /dev/null -w "%{http_code} %{url_effective}" -L --connect-timeout 8 --max-time 15 "$url" 2>/dev/null || echo "000 $url")
  local ok="false"
  if [[ "$expect" == "any" && "$code" =~ ^[23] ]]; then ok="true"
  elif [[ "$expect" == "auth" && "$code" =~ ^(200|401)$ ]]; then ok="true"
  elif [[ "$code" == "$expect" ]]; then ok="true"
  fi
  printf '{"name":"%s","url":"%s","http":%s,"final":"%s","ok":%s},\n' \
    "$name" "$url" "$code" "$final" "$ok"
}

{
  echo "{"
  echo "  \"verified_at\": \"$TS\","
  echo "  \"links\": ["
  check "TMMT Build (public)" "https://tmmt-ops.vercel.app/build" "200"
  check "TMMT Kits (public)" "https://tmmt-ops.vercel.app/kits" "200"
  check "Credit intake form" "https://tmmt-ops.vercel.app/forms/credit-funding-intake" "200"
  check "Credit shortlink" "https://tmmt-ops.vercel.app/credit" "200"
  check "Lead intake" "https://tmmt-ops.vercel.app/forms/lead-intake" "200"
  check "Affiliates" "https://tmmt-ops.vercel.app/forms/affiliates" "200"
  check "Operator join" "https://tmmt-ops.vercel.app/join" "200"
  check "Mission fit test" "https://tmmt-ops.vercel.app/fit-test" "200"
  check "Lead magnet LP" "https://tmmt-ops.vercel.app/lp/aixmos/lead-magnet" "200"
  check "Command center" "https://tmmt-command-center.vercel.app/login" "200"
  check "Brainiac Ollama" "http://brainiac-7.tailceb455.ts.net:11434/api/tags" "200"
  check "Brainiac LiteLLM" "http://brainiac-7.tailceb455.ts.net:4000/v1/models" "auth"
  check "Repo" "https://github.com/AIXMOS537/TMMT" "200"
  echo "    {\"name\":\"_end\",\"url\":\"\",\"http\":0,\"final\":\"\",\"ok\":true}"
  echo "  ]"
  echo "}"
} | sed '$ s/},/}/' > "$OUT"

PASS=$(grep -c '"ok":true' "$OUT" || true)
TOTAL=$(grep -c '"name":' "$OUT" || true)
TOTAL=$((TOTAL - 1))
echo "Verified $PASS/$TOTAL links → $OUT"
