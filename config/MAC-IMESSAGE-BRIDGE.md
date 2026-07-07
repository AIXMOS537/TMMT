# Mac iMessage Bridge

Lets **Claude Code running locally on your Mac** send and read iMessages through
the macOS Messages app — so messages (like team/absence notices) can go out over
iMessage in addition to Slack.

Bridge: [`carterlasalle/mac_messages_mcp`](https://github.com/carterlasalle/mac_messages_mcp)
— a local stdio MCP server with full **send + read** support, phone-number
validation, group chats, and attachments.

## ⚠️ Read this first — the architecture constraint

An iMessage MCP server is a **local process on the Mac** that reads the Messages
database (`~/Library/Messages/chat.db`) and drives Messages via AppleScript.

**A cloud / web Claude Code session cannot reach it.** There is no port, no relay —
it talks over stdio to whatever Claude process launched it. So:

| Where you run Claude Code | Can it use the Mac bridge? |
|---|---|
| **Locally on the Mac** (CLI `claude`, Claude Desktop, Cursor) | ✅ Yes — this is the supported path |
| **Cloud / web session** (like the one that wrote this) | ❌ No — it's in an isolated Linux container |

So "send through my work Mac" means: **run Claude Code on the Mac** and the bridge
sends from there. (Advanced alternative — exposing the bridge over a tunnel — is in
the last section, and is **not recommended** for a Messages database.)

## Setup (run on the Mac)

```bash
# from the repo root, on your work Mac:
bash scripts/setup-mac-imessage-bridge.sh
```

The script: verifies macOS → installs `uv` (if needed) → fetches `mac-messages-mcp`
→ registers it with the Claude Code CLI → prints the Full Disk Access step.

### Manual equivalent

```bash
# 1. install uv (provides uvx)
brew install uv                      # or: curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. register the server with Claude Code
claude mcp add messages -- uvx mac-messages-mcp

# 3. verify
claude mcp list
```

For **Claude Desktop / Cursor**, add to the client's MCP config instead:

```json
{
  "mcpServers": {
    "messages": {
      "command": "uvx",
      "args": ["mac-messages-mcp"]
    }
  }
}
```

### Required permission — Full Disk Access (mandatory)

`System Settings → Privacy & Security → Full Disk Access` → enable for your
**Terminal app** (and/or Claude Desktop / Cursor) → **fully quit and reopen** it.
Without this the bridge can't read `chat.db` and will fail.

> Run only **one** instance (e.g. Cursor *or* Claude Desktop, not both).

## Verify

In a **local** Claude Code session on the Mac:

```
Send an iMessage to <your number> saying "bridge test".
```

## Prerequisites

- macOS 11+
- Python 3.10+ (uv manages this)
- `uv` / `uvx`
- Claude Code installed locally on the Mac

## Advanced (not recommended): reach the bridge from a cloud session

To let a **remote** session send via the Mac you'd have to expose the bridge over
the network (wrap it as an HTTP/SSE MCP endpoint and tunnel it, e.g. Cloudflare
Tunnel / Tailscale). That puts an interface to your **personal Messages database**
on the network — real security exposure. If you genuinely need it, lock it behind
Tailscale (private network, no public ingress) and auth the MCP endpoint. Prefer
the local path above.

## Sources

- mac_messages_mcp — https://github.com/carterlasalle/mac_messages_mcp
- AppleScript-only alternative (send + contacts) — https://github.com/marissamarym/imessage-mcp-server
- Read-only alternatives — https://github.com/wyattjoh/imessage-mcp · https://github.com/hannesrudolph/imessage-query-fastmcp-mcp-server
