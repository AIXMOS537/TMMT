#!/usr/bin/env bash
# brain-live — GO LIVE ON THE M1. One command that actually turns the local brain
# on and PROVES it, instead of saying "ready." It:
#   1. finds/starts Ollama            4. runs a REAL inference (prints the answer)
#   2. pulls the model(s)             5. wires the app/Pocket at the local brain
#   3. serves it (local + tailnet)    6. prints a hard PASS/FAIL verdict
#
# Local-only. No external surface, no keys sent anywhere, idempotent, re-runnable.
# Run ON THE M1 (carry Mac):   bash scripts/brain-live.sh
#   options:  --coder   also pull the coding model (qwen2.5-coder:14b)
#             --tailnet also expose on the tailnet (0.0.0.0 → Tailscale ACL only)
#             --quick   skip model pull (assume already pulled)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1

if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; BD=; X=; fi
ok(){   printf '   %s✓%s %s\n' "$G" "$X" "$*"; }
warn(){ printf '   %s•%s %s\n' "$Y" "$X" "$*"; }
bad(){  printf '   %s✗%s %s\n' "$R" "$X" "$*"; }
step(){ printf '\n%s▶ %s%s\n' "$BD" "$*" "$X"; }
have(){ command -v "$1" >/dev/null 2>&1; }

CHAT_MODEL="${BRAIN_CHAT_MODEL:-qwen2.5:14b}"
CODE_MODEL="${BRAIN_CODE_MODEL:-qwen2.5-coder:14b}"
HOST="127.0.0.1"; PORT="11434"
PULL_CODER=0; TAILNET=0; QUICK=0
for a in "$@"; do case "$a" in
  --coder)   PULL_CODER=1;;
  --tailnet) TAILNET=1;;
  --quick)   QUICK=1;;
esac; done

FAILED=0

cat <<EOF
${C}${BD}
   ╔══════════════════════════════════════════════════════════╗
   ║   🧠  BRAIN LIVE — turn the M1 on and PROVE it            ║
   ╚══════════════════════════════════════════════════════════╝${X}
   host: $(uname -s) $(uname -m)   ·   model: ${CHAT_MODEL}$( [ "$TAILNET" = 1 ] && echo "   ·   + tailnet" )
EOF

# ── 1. Ollama present? ──────────────────────────────────────────────────────
step "1  Ollama"
if have ollama; then
  ok "ollama installed ($(ollama --version 2>/dev/null | head -1))"
else
  bad "ollama not found."
  if [[ "$(uname -s)" == Darwin ]]; then
    warn "install it:  brew install ollama   (or https://ollama.com/download)"
  else
    warn "install it:  curl -fsSL https://ollama.com/install.sh | sh"
  fi
  echo; bad "Can't go live without the runtime. Install Ollama, then re-run."; exit 1
fi

# ── 2. Serve it (start if down) ─────────────────────────────────────────────
step "2  Serve"
ping_api(){ curl -fsS --max-time 3 "http://${HOST}:${PORT}/api/tags" >/dev/null 2>&1; }
if ping_api; then
  ok "already serving on ${HOST}:${PORT}"
else
  if [ "$TAILNET" = 1 ]; then
    warn "starting with OLLAMA_HOST=0.0.0.0 (reachable on the tailnet — Tailscale ACL is the wall)"
    OLLAMA_HOST=0.0.0.0:${PORT} nohup ollama serve >/tmp/ollama-brain.log 2>&1 &
  else
    OLLAMA_HOST=${HOST}:${PORT} nohup ollama serve >/tmp/ollama-brain.log 2>&1 &
  fi
  for i in 1 2 3 4 5 6 7 8 9 10; do sleep 1; ping_api && break; done
  if ping_api; then ok "started ollama serve (log: /tmp/ollama-brain.log)"
  else bad "ollama serve didn't come up — check /tmp/ollama-brain.log"; exit 1; fi
fi

# ── 3. Model present? pull if needed ────────────────────────────────────────
step "3  Model"
has_model(){ ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
pull_one(){
  local m="$1"
  if has_model "$m"; then ok "$m already pulled"; return 0; fi
  if [ "$QUICK" = 1 ]; then warn "$m missing but --quick set — skipping pull"; return 0; fi
  warn "pulling $m (first run downloads several GB — this is the one slow step)…"
  if ollama pull "$m"; then ok "$m pulled"; else bad "failed to pull $m"; FAILED=1; fi
}
pull_one "$CHAT_MODEL"
[ "$PULL_CODER" = 1 ] && pull_one "$CODE_MODEL"

# ── 4. PROVE IT — a real inference, printed ─────────────────────────────────
step "4  Prove it (real inference)"
PROMPT='In one short sentence, confirm you are the AIXMOS local brain running on the M1 and ready to work.'
RESP="$(curl -fsS --max-time 90 "http://${HOST}:${PORT}/api/generate" \
  -d "{\"model\":\"${CHAT_MODEL}\",\"prompt\":$(printf '%s' "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"$PROMPT\""),\"stream\":false}" 2>/dev/null)"
ANSWER=""
if [ -n "$RESP" ]; then
  ANSWER="$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("response","").strip())' 2>/dev/null)"
  [ -z "$ANSWER" ] && ANSWER="$(printf '%s' "$RESP" | sed -n 's/.*"response":"\([^"]*\)".*/\1/p')"
fi
if [ -n "$ANSWER" ]; then
  ok "the M1 answered — it is genuinely running, not just installed:"
  printf '\n      %s“%s”%s\n' "$C" "$ANSWER" "$X"
else
  bad "no inference came back — the model may still be loading into RAM. Re-run in a moment."
  FAILED=1
fi

# ── 5. Wire the app / Pocket at the local brain (additive .env) ─────────────
step "5  Wire the app at the brain"
BRAIN_URL="http://${HOST}:${PORT}/v1/chat/completions"
if [ -f "$ROOT/.env" ] && grep -q '^POCKET_BRAIN_URL=' "$ROOT/.env"; then
  ok "POCKET_BRAIN_URL already set in .env"
else
  { echo "POCKET_BRAIN_URL=${BRAIN_URL}"; echo "POCKET_BRAIN_MODEL=${CHAT_MODEL}"; } >> "$ROOT/.env" 2>/dev/null \
    && ok "pointed the app/Pocket at the local brain (.env)" \
    || warn "couldn't write .env — add manually: POCKET_BRAIN_URL=${BRAIN_URL}"
fi
warn "LiteLLM router (many models, one endpoint): bash scripts/brain-router.sh  → :4000"
[ "$TAILNET" = 1 ] && warn "tailnet URL for other nodes:  http://\$(tailscale ip -4 | head -1):${PORT}"

# ── 6. Verdict ──────────────────────────────────────────────────────────────
step "Verdict"
if [ "$FAILED" = 0 ] && [ -n "$ANSWER" ]; then
  printf '   %s%sLIVE.%s The M1 brain is up, proven with real inference, and wired to the app.\n' "$G" "$BD" "$X"
  printf '   Local-first inference is ON — most work never touches a paid token now.\n'
  printf '\n   Next for money: fill NEXT_PUBLIC_GHL_* / paste GHL links → first dollar (see PLAN.md).\n'
  exit 0
else
  printf '   %s%sNOT FULLY LIVE.%s See the ✗ lines above and re-run: bash scripts/brain-live.sh\n' "$R" "$BD" "$X"
  exit 1
fi
