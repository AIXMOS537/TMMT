# hailmary-brother — inbox on Brainiac (M1)

**Run on:** `brainiac-mac` only (always-on home brain).  
**Spec:** `docs/HAILMARY-BROTHER-LAYER.md` · **Parent:** `docs/DUAL-SETUP-SYNC.md`

Uses the universal DB: `~/.hailmary/dual-sync.db` (tables `sync_inbox`, `sync_outbox`, `contact_voice`).

## One-time setup (Brainiac)

```bash
cd ~/Projects/TMMT

# 1. Brain + mesh
bash scripts/swarm-join.sh --name brainiac-mac
bash scripts/hailmary booyah

# 2. Messages bridge
bash scripts/setup-mac-imessage-bridge.sh
# System Settings → Privacy → Full Disk Access → Terminal (or your runner)

# 3. Local config (numbers stay off git)
cp config/hailmary-brother.example.yaml config/hailmary-brother.local.yaml
# Edit .local.yaml — your handles + home line
# Add to .env: HAILMARY_HOME_E164=+1...

# 4. Phone forwarding (on each iPhone)
# Settings → Messages → Text Message Forwarding → brainiac-mac ON

# 5. Inbox DB (via dual-sync)
python3 scripts/dual-sync/schema.py --import-registry
```

## Status (today)

| Script | Status |
|---|---|
| `schema.py` | SQLite inbox/outbox (tg-responder pattern) |
| `inbox-watcher.py` | 🔲 next — poll Messages, queue inbound |
| `draft-worker.py` | 🔲 next — brother/right-hand drafts, no auto-send |

Until watcher is live: use `TMMT agent jarvis …` via iMessage prefix for commands only (`~/projects/tmmt-agent-channel`).

## Verify

```bash
python3 scripts/hailmary-brother/schema.py --status
bash scripts/hailmary status
```
