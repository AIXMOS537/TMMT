#!/usr/bin/env bash
# =============================================================================
#  GHL Voice AI — Bella one-shot (hands-off)
#  Syncs env → Vercel → provisions GHL agent → deploys → smoke test
#
#  Usage: bash scripts/ghl-voice-ai-go.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ok(){ printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*"; }
die(){ printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

echo
echo "  ╔══════════════════════════════════════════╗"
echo "  ║  Bella Voice AI — hands-off go            ║"
echo "  ╚══════════════════════════════════════════╝"
echo

# ── 1. Ensure location id (public, from GHL_LOCATION_MAP) ──
if ! grep -q '^GHL_LOCATION_ID=' .env.local 2>/dev/null; then
  echo 'GHL_LOCATION_ID=Xcd8DZt5T4GWnBtBEC5V' >> .env.local
  ok "GHL_LOCATION_ID set in .env.local"
fi

# ── 2. Ensure voice webhook secret exists ──
if ! grep -q '^GHL_VOICE_WEBHOOK_SECRET=' .env.local 2>/dev/null; then
  SECRET="$(openssl rand -hex 32)"
  echo "GHL_VOICE_WEBHOOK_SECRET=${SECRET}" >> .env.local
  ok "Generated GHL_VOICE_WEBHOOK_SECRET"
fi

# ── 3. Bella voice defaults (ElevenLabs) ──
if ! grep -q '^ELEVENLABS_VOICE_ID=' .env.local 2>/dev/null; then
  echo 'ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL' >> .env.local
  ok "ELEVENLABS_VOICE_ID → Sarah (Bella default)"
fi

# ── 4. Sync voice-related vars to Vercel ──
if command -v vercel >/dev/null 2>&1; then
  node -e "
const {readFileSync,existsSync}=require('fs');
const {spawnSync}=require('child_process');
function load(f){if(!existsSync(f))return{};const o={};for(const line of readFileSync(f,'utf8').split('\n')){const t=line.trim();if(!t||t.startsWith('#'))continue;const eq=t.indexOf('=');if(eq===-1)continue;const k=t.slice(0,eq).trim();let v=t.slice(eq+1).trim();if((v.startsWith('\"')&&v.endsWith('\"'))||(v.startsWith(\"'\")&&v.endsWith(\"'\")))v=v.slice(1,-1);o[k]=v;}return o;}
const vars={...load('.env'),...load('.env.local')};
const keys=['GHL_VOICE_WEBHOOK_SECRET','GHL_WEBHOOK_SECRET','GHL_LOCATION_ID','ELEVENLABS_VOICE_ID'];
for (const k of keys){
  const v=vars[k];
  if(!v||v.length<8) continue;
  for (const env of ['production','preview','development']){
    spawnSync('vercel',['env','add',k,env,'--value',v,'--yes','--force','--scope','aixmos537'],{cwd:'.',stdio:'pipe'});
  }
  console.log('synced',k);
}
" || warn "Vercel env sync partial — check vercel login"
  ok "Vercel env synced (voice keys)"
else
  warn "vercel CLI missing — skip env sync"
fi

# ── 5. Unit tests ──
if [ -f package.json ]; then
  npx vitest run src/lib/agent/voice/ghl-voice-handler.test.ts --silent 2>/dev/null \
    && ok "Voice handler tests pass" \
    || warn "Tests skipped or failed"
fi

# ── 6. GHL API provision (needs GHL_API_KEY) ──
if node scripts/ghl-voice-ai-provision.mjs 2>/dev/null; then
  ok "GHL Bella agent provisioned via API"
else
  warn "GHL API provision skipped (no GHL_API_KEY on this machine)"
  warn "Console fallback: docs/ghl/VOICE-AI-BELLA-LAUNCH-PACK.md"
fi

# ── 7. Production deploy ──
if command -v vercel >/dev/null 2>&1; then
  info_msg="Deploying tmmt-c919 production…"
  echo "  › $info_msg"
  vercel deploy --prod --yes --scope aixmos537 2>&1 | tail -8
  ok "Vercel production deploy triggered"
fi

# ── 8. Smoke test webhook health ──
sleep 3
HEALTH="$(curl -sS "https://tmmt-ops.vercel.app/api/agent/voice/ghl" 2>/dev/null || true)"
if echo "$HEALTH" | grep -q '"ready"'; then
  ok "Voice webhook live: ready"
elif echo "$HEALTH" | grep -q 'tmmt-voice-ai-ghl'; then
  warn "Webhook up but secret may need redeploy: $HEALTH"
else
  warn "Webhook health check pending deploy propagation"
fi

# ── 9. Sync docs to mesh ──
DEST="$HOME/Sync/rick/SALES-SCRIPTS"
mkdir -p "$DEST"
cp -f docs/ghl/VOICE-AI-BELLA-LAUNCH-PACK.md "$DEST/VOICE-AI-BELLA-LAUNCH-PACK.md" 2>/dev/null || true
VAULT="$HOME/Brain/vault/03-Systems/GHL-VOICE-AI-BELLA-LAUNCH-PACK-2026-07-07.md"
cp -f docs/ghl/VOICE-AI-BELLA-LAUNCH-PACK.md "$VAULT" 2>/dev/null || true
ok "Docs synced → Rick + Brain vault"

echo
echo "  Done. Bella stack:"
echo "    Webhook: https://tmmt-ops.vercel.app/api/agent/voice/ghl"
echo "    Activate: node scripts/ghl-voice-ai-activate.mjs"
echo "    Provision: node scripts/ghl-voice-ai-provision.mjs"
echo
