#!/usr/bin/env bash
# brother-speak — talk through Rick on the M1's local model (CHUMMO warmth +
# MOOSE execution, internal tribute; public face = Rick Sorkin). Everything runs
# LOCAL on the M1 — no cloud, no PII leaves the box.
#   brother-speak "draft a warm follow-up to a renter who no-showed"
#   echo "long context" | brother-speak "summarize and give me the 3 moves"
set -uo pipefail
MODEL="${RICK_MODEL:-rick}"

ask="$*"
piped=""
[ -t 0 ] || piped="$(cat)"
[ -n "$ask$piped" ] || { echo 'usage: brother-speak "your ask"   (or pipe context in)'; exit 1; }

command -v ollama >/dev/null 2>&1 || { echo "✗ ollama not installed — get it at ollama.com, then run: rick-sorkin up" >&2; exit 1; }
curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || (ollama serve >/dev/null 2>&1 &) && sleep 2

# Fall back to a base model if the rick persona hasn't been built yet.
if ! ollama list 2>/dev/null | grep -q "^${MODEL}\b"; then
  MODEL="$(ollama list 2>/dev/null | awk 'NR==2{print $1}')"; MODEL="${MODEL:-qwen2.5:14b}"
fi

prompt="$ask"
[ -n "$piped" ] && prompt="$ask"$'\n\n---\n'"$piped"
exec ollama run "$MODEL" "$prompt"
