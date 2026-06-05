#!/usr/bin/env bash
set -euo pipefail
REPO="${TMMT_REPO_ROOT:-$HOME/dev/TMMT}"
ENV="${REPO}/scripts/office-agent-channel/.env"
SECRET="$(grep '^REMOTE_CMD_SECRET=' "$ENV" 2>/dev/null | cut -d= -f2- || true)"
TS_IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
[[ -n "$TS_IP" && "$TS_IP" != *"failed"* ]] || TS_IP="100.85.8.8"
CARD="${HOME}/Desktop/WORK-MAC-COMMAND-HUB.md"

cat >"$CARD" <<EOF
# Work Mac command hub — LIVE

## iPhone: text this Mac (iMessage)
\`\`\`
TMMT help
TMMT status
TMMT ops what's pending
\`\`\`

## iPhone / carry Mac: HTTP (works on Verizon, no chat.db needed)
\`\`\`bash
curl -sS -X POST "http://${TS_IP}:9876/cmd" \\
  -H "Authorization: Bearer ${SECRET}" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"TMMT status"}'
\`\`\`

**iPhone Shortcut:** duplicate the curl as "Get Contents of URL" POST to \`http://${TS_IP}:9876/cmd\` with header \`Authorization: Bearer ${SECRET}\` and JSON body \`{"text":"TMMT status"}\`.

## From Cursor
Ask the agent to text you or run TMMT commands.

## Re-wire everything
\`\`\`bash
bash ~/dev/TMMT/scripts/wire-work-mac-now.sh
\`\`\`

## Logs
- iMessage: \`~/Library/Logs/tmmt-imessage-watcher.log\`
- HTTP: \`~/Library/Logs/tmmt-remote-command-server.log\`
EOF
echo "Wrote ${CARD}"
