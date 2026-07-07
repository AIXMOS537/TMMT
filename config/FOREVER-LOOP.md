# FOREVER LOOP — Autonomous Mesh (Zero Typing)

**Authority:** PROJECT X HAILMARY · **Updated:** 2026-07-04

One command boots the full agent team on any device. Humans approve money/deploy only; everything else runs autonomously and logs to watchtower.

---

## One command

```bash
bash scripts/forever-up.sh          # auto-detect role
bash scripts/forever-up.sh carry    # owner Mac
bash scripts/forever-up.sh forge    # build Mac
bash scripts/forever-up.sh rick     # M1 fleet
```

After BLIP drop:

```bash
BLIP_ROLE=carry bash scripts/blip/DROP-AND-GO.sh
```

---

## What runs 24/7 (macOS LaunchAgents)

| Daemon | Job |
|--------|-----|
| `com.tmmt.forever-loop` | Sync · presence · heartbeat · role probes · P0 dispatch |
| `com.tmmt.router` | Overdrive board — claim/run agent tasks |
| `com.tmmt.memory-sync` | Push HAILMARY memory → vault (if `HAILMARY_VAULT` set) |
| `com.aixmos.hailmary` | Ollama + memory API keepalive |
| `com.tmmt.voice-inbox` | Voice/media → vault (if capture installed) |

---

## Role ticks (every 3–5 min)

| Role | Autonomous work |
|------|-----------------|
| **carry** | GHL audit log · integration probe · dispatch P0 → Rick |
| **forge** | Build probe · integration test · dispatch |
| **brain** | Ollama/LiteLLM ping · memory sync |
| **rick** | Scan FLEET-INBOX · dispatch |
| **ops** | Integration probe |

---

## Agent dispatch (no owner typing)

`scripts/mesh/agent-dispatch.sh` reads:

- `~/Brain/vault/00-Dashboard/IDEA-QUEUE-LIVE.md` (OPEN P0)
- `~/Brain/vault/00-Dashboard/HANDOFF-TO-FORGE/*.md`

Writes missions to `~/Sync/rick/FLEET-INBOX/auto-*.md` once per hour (deduped). Logs to watchtower inbox — **does not ping owner**.

---

## Owner visibility

```bash
watchtower                              # health + last 12 inbox lines
tail -f .swarm/forever-loop.log         # tick log
bash scripts/mesh/forever-loop.sh status
```

Owner notified **urgent/emergency only** — see `config/notify-policy.json`.

---

## DARK kill-switch

`.swarm/DARK` stops all ticks. Lift: `bash scripts/godark lift`

---

## Mesh boot chain

```
forever-up → forever-loop + router + memory + hailmary
unison up  → hailmary booyah → memory-sync → (calls forever-up on carry)
oneshot    → forever-up → serve owner plate
go         → pull + unison → forever-up side effects via hailmary
```

---

## Canon

- Strategy: `docs/GO-LIVE-CANON.md`
- Mesh pack: `docs/MESH-GO-LIVE-PACK.md`
- AI paste: `docs/ONE-SHOT-AI.md`
