#!/usr/bin/env bash
# PreToolUse owner-approval guard — the "real gate" referenced in CLAUDE.md §2
# ("never auto-execute send/pay/sign/ship"). It inspects each Bash tool call and
# BLOCKS the riskiest production-bound action: a direct production deploy that
# bypasses the verified, owner-driven `npm run ship` path.
#
# It tokenizes the command (shlex) and splits on shell operators, so it only
# fires when `vercel` is the actual command being RUN with a prod flag — never
# when those words merely appear inside a quoted string (e.g. a commit message
# or an echo). Master-branch history is already protected by scripts/hooks/pre-push.
#
# Fail-OPEN: any read/parse problem allows the call — this guard never bricks a
# session. Exit 0 = allow, exit 2 = block (message goes back to the model).
set -uo pipefail

payload="$(cat 2>/dev/null || true)"
[ -n "$payload" ] || exit 0

printf '%s' "$payload" | python3 -c '
import sys, json, shlex, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if data.get("tool_name") != "Bash":
    sys.exit(0)
cmd = (data.get("tool_input") or {}).get("command", "")
if not cmd:
    sys.exit(0)

# Split into individual command segments on shell operators.
segments = re.split(r"[;\n&|]+", cmd)
for seg in segments:
    seg = seg.strip()
    if not seg:
        continue
    try:
        toks = shlex.split(seg)
    except Exception:
        continue
    i = 0
    # skip leading VAR=value assignments and common prefixes
    while i < len(toks) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[i]):
        i += 1
    while i < len(toks) and toks[i] in ("sudo", "env", "command", "npx", "time"):
        i += 1
    if i >= len(toks):
        continue
    first = toks[i]
    rest = toks[i + 1:]
    is_prod = any(t in ("--prod", "--production") for t in rest)
    if first == "vercel" and is_prod:
        sys.stderr.write(
            "OWNER-APPROVAL GATE: production deploy blocked.\n"
            "Go live only via the gated path: npm run ship (verifies lint+test+build "
            "locally first, confirms, then deploys) with owner sign-off. CLAUDE.md section 2.\n"
        )
        sys.exit(2)

sys.exit(0)
'
