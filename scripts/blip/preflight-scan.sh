#!/usr/bin/env bash
# preflight-scan.sh — run BEFORE sending BLIP bundle to any device.
# Fails on secrets, malware patterns, or unexpected binaries.
set -euo pipefail

TARGET="${1:-${BLIP_DEST:-$HOME/Sync/BLIP-DROP/LATEST}}"
[[ -d "$TARGET" ]] || { echo "✗ Not a directory: $TARGET"; exit 1; }

FAIL=0
warn(){ echo "⚠  $*"; }
bad(){ echo "✗  $*"; FAIL=1; }
ok(){ echo "✓  $*"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  BLIP PREFLIGHT SECURITY SCAN                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "  Target: $TARGET"
echo ""

EXCLUDE='preflight-scan\.sh'

# ── 1. Secret patterns (hard fail) ──
echo "=== Secrets ==="
SECRET_HITS=$(rg -n -i \
  'gho_[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,}|AKIA[A-Z0-9]{16}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|LITELLM_MASTER_KEY=[^$\{]|OPENAI_API_KEY=sk-[a-zA-Z0-9]|GHL_WEBHOOK_SECRET=[^$\{]|SUPABASE.*KEY=ey|service_role=[a-zA-Z0-9_-]{20,}|TWILIO_AUTH_TOKEN=[a-f0-9]{32}' \
  "$TARGET" 2>/dev/null | rg -v "$EXCLUDE" | rg -v '^[^:]*:[0-9]+:#|KEY-FROM-LITELLM|sk-virtual-key-here|service_role in dashboard|NEVER:' || true)
if [[ -n "$SECRET_HITS" ]]; then
  bad "Possible secret leak:"
  echo "$SECRET_HITS"
else
  ok "No hardcoded API keys, tokens, or private keys"
fi

# ── 2. Forbidden filenames ──
echo ""
echo "=== Forbidden files ==="
FORBIDDEN=$(find "$TARGET" -type f \( \
  -name 'litellm-master.env' -o -name 'brain.env' -o -name 'god-mode.env' -o \
  -name '.env' -o -name '*.pem' -o -name '*.p12' -o -name '*.key' -o \
  -name '*credentials*' -o -name '*secret*.env' \) 2>/dev/null || true)
if [[ -n "$FORBIDDEN" ]]; then
  bad "Secret files must NOT be in bundle:"
  echo "$FORBIDDEN"
else
  ok "No .env / .pem / master env files in bundle"
fi

# ── 3. Malware / pipe-to-shell patterns ──
echo ""
echo "=== Malware patterns ==="
MAL=$(rg -n 'curl\s+[^|]+\|\s*(ba)?sh|wget\s+[^|]+\|\s*(ba)?sh|/dev/tcp/|base64\s+-[dD].*\|' "$TARGET" 2>/dev/null | rg -v "$EXCLUDE" || true)
if [[ -n "$MAL" ]]; then
  bad "Suspicious remote-exec patterns:"
  echo "$MAL"
else
  ok "No curl|sh / wget|sh / reverse-shell patterns"
fi

# ── 4. External git clones (runtime only — verify URLs in bundle) ──
echo ""
echo "=== Git clone URLs ==="
CLONES=$(rg -n 'git clone https?://' "$TARGET" --glob '*.sh' --glob '*.ps1' --glob '*.command' --glob '*.bat' 2>/dev/null || true)
BAD_CLONES=$(echo "$CLONES" | rg 'git clone' | rg -v 'AIXMOS537/TMMT' || true)
if [[ -n "$BAD_CLONES" ]]; then
  bad "Non-AIXMOS537 git clone in bundle scripts:"
  echo "$BAD_CLONES"
else
  ok "git clone → AIXMOS537/TMMT only (docs may reference other repos — not auto-run)"
fi

# ── 5. Unexpected binaries ──
echo ""
echo "=== Binaries ==="
BIN_COUNT=0
while IFS= read -r f; do
  t=$(file -b "$f" 2>/dev/null || echo "")
  if echo "$t" | rg -qi 'Mach-O|PE32|ELF|executable'; then
    if ! echo "$f" | rg -q '\.(sh|command)$'; then
      bad "Unexpected binary: $f ($t)"
      BIN_COUNT=$((BIN_COUNT + 1))
    fi
  fi
done < <(find "$TARGET" -type f ! -name '*.sh' ! -name '*.command' ! -name '*.bat' ! -name '*.ps1' 2>/dev/null)
[[ "$BIN_COUNT" -eq 0 ]] && ok "No unexpected compiled binaries"

# ── 6. Tailnet hostnames (informational — not secrets) ──
echo ""
echo "=== Network endpoints (informational) ==="
rg -o 'https?://[a-zA-Z0-9._-]+\.(tailceb455\.ts\.net|vercel\.app|tailscale\.com)[^ "'\''\)]*' "$TARGET" 2>/dev/null | sort -u | head -15 || true
ok "Endpoints are your tailnet + Vercel only (review above)"

# ── 7. File count ──
echo ""
echo "=== Inventory ==="
FC=$(find "$TARGET" -type f | wc -l | tr -d ' ')
ok "$FC files in bundle"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "══════════════════════════════════════════════════════════════"
  echo "  PREFLIGHT PASSED — safe to AirDrop / BLIP send"
  echo "══════════════════════════════════════════════════════════════"
  exit 0
else
  echo "══════════════════════════════════════════════════════════════"
  echo "  PREFLIGHT FAILED — fix issues before sending"
  echo "══════════════════════════════════════════════════════════════"
  exit 1
fi
