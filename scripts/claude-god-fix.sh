#!/usr/bin/env bash
# claude-god-fix.sh — restore native Anthropic for Fable 5 (stop LiteLLM/CCR hijack).
set -euo pipefail
SETTINGS="$HOME/.claude/settings.json"
BACKUP="$HOME/.claude/settings.json.bak-$(date +%Y%m%d-%H%M%S)"
TMMT="$HOME/.config/tmmt"

cp -f "$SETTINGS" "$BACKUP" 2>/dev/null || true

# Sovereign settings: native Anthropic OAuth — NO CCR/LiteLLM proxy
python3 <<'PY'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
orig = os.path.expanduser("~/.claude/settings.json.ccr-original")
if os.path.isfile(orig):
    with open(orig) as f:
        data = json.load(f)
else:
    with open(p) as f:
        data = json.load(f)
    data.pop("env", None)
    data.pop("apiKeyHelper", None)
# Ensure Fable model names for native Max subscription
data["model"] = "claude-fable-5"
data["fallbackModel"] = ["claude-opus-4-8", "default"]
with open(p, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print("✓ settings.json → native Anthropic (no CCR/LiteLLM env)")
PY

# Kill proxy env for this shell and god sessions
unset ANTHROPIC_BASE_URL ANTHROPIC_API_BASE_URL CLAUDE_AGENT_API_BASE_URL \
  CLAUDE_CODE_USE_OPENAI OPENAI_BASE_URL OPENAI_API_KEY 2>/dev/null || true
unset CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY 2>/dev/null || true

date -u +%Y-%m-%dT%H:%M:%SZ > "$TMMT/.claude-native-god.ready"

cat <<'EOF'

╔══════════════════════════════════════════════════════════════╗
║  CLAUDE GOD FIX — native Fable 5 lane restored               ║
╠══════════════════════════════════════════════════════════════╣
║  Start Fable (YOUR session only):                            ║
║    cd ~/Brain/vault && claude                                ║
║                                                              ║
║  Local loops (FREE — Rick/M1):                               ║
║    forge on && occ                                           ║
║    OR: booyah fast                                           ║
╚══════════════════════════════════════════════════════════════╝
EOF
