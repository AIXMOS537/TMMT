# Cursor ↔ Claude Code ↔ Cowork — what works from here

**Machine:** carry-mac · **Date:** 2026-06-21

## What Cursor (this chat) CAN do

| Action | Command | Verified |
|--------|---------|----------|
| Run mesh / family loop | `bash scripts/tmmt homeloop` | ✅ |
| Package handoff to M1 | `bash scripts/tmmt handoff` | ✅ |
| Finance sweep | `bash scripts/tmmt finance sweep` | ✅ |
| **Send work to Claude Code** | `bash scripts/dispatch-to-claude.sh --print "task"` | ✅ (tested) |
| **Open Claude Code session** | `bash scripts/dispatch-to-claude.sh "full task"` | ✅ CLI 2.1.165 |
| Queue swarm task | `bash scripts/dispatch-to-claude.sh --swarm "task"` | ✅ |
| List Vercel projects | `vercel project ls --scope aixmos537` | ✅ 5 apps |
| GitHub API | `gh api user` | ✅ |

## What Cursor CANNOT do directly

| Tool | Why | Workaround |
|------|-----|------------|
| **Claude Cowork UI** | Separate Desktop app; no API from Cursor | Paste same prompt into Cowork, or use `dispatch-to-claude.sh` → Claude Code |
| **Stripe MCP** | Needs auth in Cursor Settings → MCP | Connect Stripe plugin, then ask for subscription list |
| **iMessage send** | Must run on M1 with bridge | `tailscale ssh brainiac-mac` + setup bridge |
| **Read your bank** | No credentials in repo | Drop CSVs in `imports/finance/statements/` (gitignored) |

## Claude Cowork on this Mac

Sessions live at:
`~/Library/Application Support/Claude/local-agent-mode-sessions/`

Cursor **cannot click Cowork for you**, but you can:

1. Copy prompt: `bash scripts/claude-finance.sh --prompt | pbcopy`
2. Open **Claude Desktop → Cowork** and paste
3. Or use Claude Code (same brain, terminal): `bash scripts/tmmt dispatch "$(bash scripts/claude-finance.sh --instruction)"`

## Recommended dispatch flows

### Finance (bills + cost cuts)
```bash
cd ~/Projects/TMMT
claude "$(bash scripts/claude-finance.sh --instruction)"
```

### Family mesh (M1 + GPU + NAS)
```bash
claude "$(bash scripts/claude-family-mesh.sh --instruction)"
```

### Quick read-only answer (cheap)
```bash
bash scripts/dispatch-to-claude.sh --print "Your question"
```

### Parallel agents (swarm)
```bash
bash scripts/dispatch-to-claude.sh --swarm "$(bash scripts/claude-finance.sh --instruction)"
npm run swarm -- up 2
```

### Home brain (M1)
```bash
bash scripts/tmmt handoff --push   # if rsync works
tailscale ssh you@brainiac-mac
claude "Read .swarm/handoff-latest/README.md — one step"
```

## Command loop (future: text from phone)

Already designed in `~/.cursor/watchtower/command-loop.md`:

```
Telegram / iMessage / Slack → command_router.py → TMMT ops / AIXMOS-AGENTS / gateway
```

Gaps: deploy Slack bot on Brainiac, wire `OPS_COMMAND_SECRET` on prod.

## One subscription rule (save money)

**Cursor + Claude Code = one Claude Max story.** Don't pay for duplicate dev AI seats unless a second human needs full-time access.
