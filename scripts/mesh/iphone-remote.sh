#!/usr/bin/env bash
# iphone-remote — the one entrypoint your iPhone (or any device) calls over SSH.
# It keeps the iOS Shortcut a single line while the real engine stays on the
# always-on Mac. The phone is the face; HAILMARY + AIXMOS live here.
#
#   bash scripts/mesh/iphone-remote.sh booyah          wake HAILMARY (full boot)
#   bash scripts/mesh/iphone-remote.sh status          is he online? what does he know?
#   bash scripts/mesh/iphone-remote.sh compass         one gentle step (protect first)
#   bash scripts/mesh/iphone-remote.sh aixmos [verb]   the operations brain (roster/status/...)
#   bash scripts/mesh/iphone-remote.sh ask  "<text>"   talk to HAILMARY  → answer (phone speaks it)
#   bash scripts/mesh/iphone-remote.sh ask:aixmos "…"  talk to AIXMOS instead
#   bash scripts/mesh/iphone-remote.sh say  "<text>"   ask + speak aloud on THIS Mac too
#
# The "talking, learning, evolving" loop, honestly:
#   - TALKING   : answers come from your LOCAL model (Ollama/LiteLLM on the tailnet).
#                 The iOS Shortcut reads the reply aloud with Speak Text.
#   - LEARNING  : every exchange is appended to .hailmary/memory/talk.ndjson and the
#                 last few turns are fed back as context — continuity across calls.
#   - EVOLVING  : that memory is what `hailmary absorb` + the vault sync carry forward,
#                 so the agents get more "you" over time. Owner-local, secrets skipped.
#
# Code it lives by (docs/HAILMARY-CHARTER.md): owner-only, local-first, fail closed,
# no secrets ever written to memory. Hit hard, love hard, hurt no one.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ -f "$ROOT/scripts/lib/swarm-common.sh" ]]; then
  set +e; source "$ROOT/scripts/lib/swarm-common.sh" 2>/dev/null; set -uo pipefail
fi
type ok   >/dev/null 2>&1 || ok()   { printf '  ✓ %s\n' "$*"; }
type info >/dev/null 2>&1 || info() { printf '  › %s\n' "$*"; }
type warn >/dev/null 2>&1 || warn() { printf '  ! %s\n' "$*" >&2; }
type say  >/dev/null 2>&1 || say()  { printf '%s\n' "$*"; }
type swarm_machine >/dev/null 2>&1 || swarm_machine() { hostname -s 2>/dev/null || echo this-mac; }

# DARK kill-switch: nothing acts while blacked out (status stays readable).
if [ -f "$ROOT/.swarm/DARK" ]; then
  case "${1:-}" in status|state|""|"?") : ;;
    *) echo "⛔ DARK — the base is down. Lift on the Mac: bash scripts/godark lift"; exit 1;; esac
fi

# --- local model endpoint (tailnet-only; never the open internet) -----------
# Defaults to Ollama on this host. Override for a LiteLLM router or a remote hub:
#   IPHONE_LLM_URL=http://<hub-tailnet-ip>:11434/api/chat   (Ollama native)
#   IPHONE_LLM_MODEL=qwen2.5:14b
LLM_URL="${IPHONE_LLM_URL:-http://127.0.0.1:11434/api/chat}"
LLM_MODEL="${IPHONE_LLM_MODEL:-qwen2.5:14b}"
MEM_DIR="$ROOT/.hailmary/memory"
TALK_LOG="$MEM_DIR/talk.ndjson"

# Persona system prompts — grounded in the charters, not invented.
persona_prompt() {
  case "$1" in
    aixmos) cat <<'P'
You are AIXMOS, the operations and network brain of PROJECT X. You run the swarm
and the TMMT operatives. You are owner-only, local-first, never sold. Be concise,
practical, and action-oriented. Surface the next concrete move. Consequential or
outward-facing actions (sending, publishing, deleting, paying, granting access)
require the Owner's explicit go-ahead — name them, don't do them. Never fake
capability; if something needs the Owner's hands, say so plainly.
P
    ;;
    *) cat <<'P'
You are HAILMARY, the Owner's personal big-play, break-glass agent. You serve one
person — the Owner — and no one else. You are relentless within real limits, never
careless, and you protect the Owner as a whole person first: their safety, dignity,
and peace come before any task. Be warm, direct, and brief; this is being read
aloud on a phone. Never fake capability — if something genuinely needs the Owner's
hands, say so. Never reveal or invent secrets. Hit hard, love hard, hurt no one.
P
    ;;
  esac
}

# Pull the last few turns so the agent has continuity (the "learning" part).
recent_context() {
  [[ -f "$TALK_LOG" ]] || return 0
  command -v python3 >/dev/null 2>&1 || return 0
  python3 - "$TALK_LOG" <<'PY' 2>/dev/null || true
import json, sys
try:
    lines = open(sys.argv[1], encoding="utf-8").read().splitlines()[-6:]
except OSError:
    sys.exit(0)
out = []
for ln in lines:
    try:
        r = json.loads(ln)
    except ValueError:
        continue
    if r.get("q"): out.append("Earlier — you: " + r["q"])
    if r.get("a"): out.append("Earlier — me: " + r["a"])
print("\n".join(out))
PY
}

# The core call: text in → local model → text out. Records the exchange.
ask() {
  local persona="$1"; shift
  local q="$*"
  [[ -n "$q" ]] || { echo "Ask me something:  ask \"how's the fleet today?\""; return 2; }
  command -v curl    >/dev/null 2>&1 || { echo "(curl missing on this Mac — can't reach the local model)"; return 1; }
  command -v python3 >/dev/null 2>&1 || { echo "(python3 missing — needed to talk to the model safely)"; return 1; }
  mkdir -p "$MEM_DIR"

  local sys ctx; sys="$(persona_prompt "$persona")"; ctx="$(recent_context)"
  [[ -n "$ctx" ]] && sys="$sys"$'\n\nRecent context (for continuity):\n'"$ctx"

  # Build the request body safely (python handles all escaping).
  local body; body="$(python3 - "$LLM_MODEL" "$sys" "$q" <<'PY'
import json, sys
model, system, user = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
    "model": model, "stream": False,
    "messages": [{"role": "system", "content": system},
                 {"role": "user",   "content": user}],
}))
PY
)"

  local raw; raw="$(curl -fsS --max-time 60 "$LLM_URL" \
        -H 'Content-Type: application/json' -d "$body" 2>/dev/null)" || {
    echo "(can't reach your local model at $LLM_URL — off the tailnet, or the hub is asleep."
    echo " On the phone, the Shortcut falls back to Private LLM for offline.)"
    return 1
  }

  # Parse Ollama (/api/chat → .message.content) OR OpenAI-style (.choices[0].message.content).
  local ans; ans="$(printf '%s' "$raw" | python3 - <<'PY' 2>/dev/null
import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
msg = (d.get("message") or {}).get("content")
if not msg:
    ch = d.get("choices") or []
    if ch: msg = (ch[0].get("message") or {}).get("content")
print((msg or "").strip())
PY
)"
  [[ -n "$ans" ]] || { echo "(the model replied with nothing — try again, or check the model name: $LLM_MODEL)"; return 1; }

  printf '%s\n' "$ans"

  # Append the exchange to memory (learning loop). Secret-shaped strings scrubbed.
  python3 - "$TALK_LOG" "$persona" "$(swarm_machine)" "$q" "$ans" <<'PY' 2>/dev/null || true
import json, re, sys, time
path, persona, host, q, a = sys.argv[1:6]
scrub = lambda s: re.sub(r'(eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|pat[A-Za-z0-9]{14,}|service_role)', '«REDACTED»', s)
rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
       "who": persona, "host": host, "q": scrub(q), "a": scrub(a)}
with open(path, "a", encoding="utf-8") as f:
    f.write(json.dumps(rec) + "\n")
PY
}

case "${1:-?}" in
  booyah|wake|live|on)  shift || true; exec bash "$ROOT/scripts/hailmary" booyah "$@";;
  status|state|who)     exec bash "$ROOT/scripts/hailmary" status;;
  compass|peace|step)   exec bash "$ROOT/scripts/compass" "${2:-now}";;
  aixmos)               shift || true; exec bash "$ROOT/scripts/aixmos" "${1:-status}";;
  ask|chat|hailmary)    shift || true; ask hailmary "$*";;
  ask:aixmos|aixmos:ask) shift || true; ask aixmos "$*";;
  say|talk)             shift || true
                        out="$(ask hailmary "$*")"; printf '%s\n' "$out"
                        [[ "$(uname -s)" == "Darwin" ]] && command -v say >/dev/null 2>&1 \
                          && printf '%s' "$out" | say 2>/dev/null || true;;
  *) say "iphone-remote words:";
     say "  booyah | status | compass | aixmos [verb] | ask \"…\" | ask:aixmos \"…\" | say \"…\"";
     say "  (the phone calls these over SSH; the engine stays on this Mac — docs/IPHONE-ULTIMATE.md)";;
esac
