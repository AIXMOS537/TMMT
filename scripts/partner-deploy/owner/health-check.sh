#!/usr/bin/env bash
# health-check.sh — single-command pre-flight before shipping any partner USB.
# Runs everything that doesn't require destructive action. Reports red/yellow/green.
#
# Usage:
#   ./owner/health-check.sh [--partner=moe-legacy]
#
# Exit 0: all green or yellow. Exit 1: any red. Use exit code in CI.

set -uo pipefail

PARTNER="${1#--partner=}"
[[ "$PARTNER" == "$1" ]] && PARTNER="moe-legacy"

RED=0; YEL=0
g(){ printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
y(){ printf '\033[0;33m  ⚠ %s\033[0m\n' "$*"; YEL=$((YEL+1)); }
r(){ printf '\033[0;31m  ✗ %s\033[0m\n' "$*"; RED=$((RED+1)); }
hdr(){ printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEGAL_DIR="$HOME/Documents/Business/legal/$PARTNER"
ENV_FILE="$HOME/.config/tmmt/partner-deploy.env"

# ============================================================================
hdr "1. Env file"
# ============================================================================
if [[ -f "$ENV_FILE" ]]; then
  g "exists at $ENV_FILE"
  mode=$(stat -f '%Sp' "$ENV_FILE" 2>/dev/null)
  [[ "$mode" == "-rw-------" ]] && g "mode 600" || y "mode is $mode (should be -rw-------)"
  source "$ENV_FILE" 2>/dev/null || r "source failed"
  if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    if [[ ${#SUPABASE_SERVICE_ROLE_KEY} -lt 100 ]]; then
      r "SUPABASE_SERVICE_ROLE_KEY too short (${#SUPABASE_SERVICE_ROLE_KEY} chars) — likely placeholder"
    elif [[ "$SUPABASE_SERVICE_ROLE_KEY" == *"<paste"* ]]; then
      r "SUPABASE_SERVICE_ROLE_KEY still has placeholder text"
    else
      g "SUPABASE_SERVICE_ROLE_KEY shape OK (${#SUPABASE_SERVICE_ROLE_KEY} chars)"
    fi
  else
    r "SUPABASE_SERVICE_ROLE_KEY unset"
  fi
  [[ -n "${SUPABASE_URL:-}" ]] && g "SUPABASE_URL set" || r "SUPABASE_URL unset"
  [[ -n "${OWNER_EMAIL:-}" ]] && g "OWNER_EMAIL set" || y "OWNER_EMAIL unset"
  [[ -n "${TAILSCALE_API_KEY:-}" && ${#TAILSCALE_API_KEY} -gt 30 ]] \
    && g "TAILSCALE_API_KEY shape OK" \
    || y "TAILSCALE_API_KEY missing or short (Tailscale ACL check will be skipped)"
else
  r "env file missing — copy partner-deploy.env.template"
fi

# ============================================================================
hdr "2. Supabase reachability"
# ============================================================================
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && ${#SUPABASE_SERVICE_ROLE_KEY} -gt 100 ]]; then
  http=$(curl -sS -o /tmp/hc-sb -w "%{http_code}" \
    "$SUPABASE_URL/rest/v1/" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" 2>&1)
  if [[ "$http" == "200" ]]; then
    g "REST API auth OK"
    # Schema check
    pt=$(curl -sS -o /tmp/hc-pt -w "%{http_code}" \
      "$SUPABASE_URL/rest/v1/partner_tenants?select=tenant_id&limit=1" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" 2>&1)
    [[ "$pt" == "200" ]] && g "partner_tenants table exists" || r "partner_tenants table missing (apply sql/20260609_partner_tenancy.sql)"
  else
    r "REST API returned HTTP $http (check keys)"
  fi
else
  y "skipped (env not complete)"
fi

# ============================================================================
hdr "3. Partner-deploy script integrity"
# ============================================================================
for f in \
  provision-partner.sh \
  burn-partner-usb.sh \
  owner/verify-readiness.sh \
  owner/issue-license.sh \
  owner/kill-partner.sh \
  owner/recovery-flow.sh \
  owner/audit-readout.sh \
  tests/dry-run.sh \
  uninstall.sh; do
  if [[ -x "$ROOT/$f" ]]; then
    bash -n "$ROOT/$f" 2>/dev/null && g "$f" || r "$f syntax error"
  else
    r "$f missing or not executable"
  fi
done
for f in partner-payload/*.py; do
  if [[ -f "$ROOT/$f" ]]; then
    /usr/bin/python3 -m py_compile "$ROOT/$f" 2>/dev/null && g "$f" || r "$f syntax error"
  fi
done

# ============================================================================
hdr "4. Legal v0 docs"
# ============================================================================
for f in master-partner-agreement.md dpa.md aup.md; do
  [[ -f "$LEGAL_DIR/$f" ]] && g "$f present" || r "$f missing from $LEGAL_DIR"
done
# Check that softened amendment language landed (no stale "pending attorney" promise)
if [[ -f "$LEGAL_DIR/master-partner-agreement.md" ]]; then
  if grep -q "pending attorney review" "$LEGAL_DIR/master-partner-agreement.md"; then
    y "MPA still has 'pending attorney review' language (stale)"
  else
    g "MPA amendment language softened"
  fi
fi

# ============================================================================
hdr "5. Hermes bridge"
# ============================================================================
BRIDGE="$HOME/Projects/AIXMOS-AGENTS/hermes-bridge"
[[ -f "$BRIDGE/tools.json" ]] && {
  tools=$(/usr/bin/python3 -c "import json; print(len(json.load(open('$BRIDGE/tools.json'))))")
  g "tools.json present ($tools skills registered)"
} || y "tools.json missing (run python3 $BRIDGE/skills_to_tools.py)"

# ============================================================================
hdr "6. Ollama (local model runtime)"
# ============================================================================
if curl -sS -m 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
  g "ollama serving on :11434"
  for m in llama3.2:3b qwen3:8b hermes3:8b; do
    if curl -sS http://localhost:11434/api/tags 2>/dev/null | grep -q "\"name\":\"$m\""; then
      g "model $m pulled"
    else
      y "model $m not pulled (optional)"
    fi
  done
else
  y "ollama not running (start Ollama.app or 'ollama serve')"
fi

# ============================================================================
hdr "7. Tailscale state"
# ============================================================================
TS=""
if command -v tailscale >/dev/null; then TS=tailscale
elif [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
fi
if [[ -n "$TS" ]]; then
  if $TS status >/dev/null 2>&1; then
    g "tailnet up"
    brainiac=$($TS status | grep -i brainiac | head -1)
    if [[ -n "$brainiac" ]]; then
      if echo "$brainiac" | grep -q "offline"; then
        y "BRAINIAC-7 OFFLINE (no Claude-backed fallback for agents)"
      else
        g "BRAINIAC-7 online"
      fi
    fi
  else
    y "tailscale not running"
  fi
else
  y "tailscale CLI not in PATH"
fi

# ============================================================================
hdr "8. Issued bundle for $PARTNER"
# ============================================================================
ISSUED="$ROOT/_issued/$PARTNER"
if [[ -d "$ISSUED" ]]; then
  g "issued bundle present"
  [[ -s "$ISSUED/install-token.txt" ]] && g "install token present" || y "install token missing or empty"
  [[ -s "$ISSUED/partner-config.env" ]] && g "partner-config present" || y "partner-config missing"
  [[ -s "$ISSUED/RECOVERY-PHRASE.txt" ]] && g "recovery phrase present" || y "recovery phrase missing"
else
  y "no issued bundle yet for $PARTNER (run owner/issue-license.sh)"
fi

# ============================================================================
hdr "9. Scheduled task state"
# ============================================================================
TASK="$HOME/.claude/scheduled-tasks/moe-legacy-attorney-engagement-nudge/SKILL.md"
if [[ -f "$TASK" ]]; then
  if grep -q "no-attorney path\|install-status" "$TASK" 2>/dev/null; then
    g "nudge repurposed to install-status check"
  else
    y "nudge present but may still chase attorney"
  fi
else
  y "no scheduled nudge"
fi

# ============================================================================
echo
if (( RED > 0 )); then
  printf '\n\033[0;31m===== %d FAIL, %d WARN =====\033[0m\n' $RED $YEL
  exit 1
elif (( YEL > 0 )); then
  printf '\n\033[0;33m===== 0 fail, %d warn — yellow but shippable =====\033[0m\n' $YEL
  exit 0
else
  printf '\n\033[0;32m===== ALL GREEN =====\033[0m\n'
  exit 0
fi
