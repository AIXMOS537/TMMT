# HAILMARY Brother Layer — home brain, your voice, your move

**Parent system:** `docs/DUAL-SETUP-SYNC.md` (universal mobile ↔ brain registry)  
**Owner:** PROJECT X HAILMARY · **Home brain:** M1 (`brainiac-mac`) · **Mobile:** Carry M5 (window, not the brain)

Plain goal: your home Mac stays on. Messages hit it. HAILMARY is your **right-hand brother first** — learns how you talk per person — then drafts or sends **as you** only on the ladder you approve. Carry Mac can close; the M1 does not sleep on this job.

> **No phone numbers in git.** Put real numbers only in gitignored `.env` / `config/hailmary-brother.local.yaml`. Example config: `config/hailmary-brother.example.yaml`.

---

## What you described (locked in)

1. **Brother first** — the agent is the 1:1 brother you never had (only boy, two sisters you work with — different lane). Right hand before second-in-command.
2. **Learn before speak** — watch how you codeswitch (family, client, operator, hater, partner). Rubik cube: same core, different face per room.
3. **Forward everything** — personal + business phones → home brain → HAILMARY queue.
4. **Reply as you** — only after enough learned examples per contact; default is **draft**, not blast.
5. **Life + business** — rejections, rebuttals, 9–5 grind, vision, family, back-burner projects — home business stays in sync with mission.

---

## What already exists (reuse)

| Piece | Where | What it does today |
|---|---|---|
| **Home brain runbook** | `docs/BRAINIAC-MAC-SETUP.md` | M1 always-on, Tailscale, `hailmary booyah`, iMessage bridge |
| **iMessage send/read** | `docs/MAC-IMESSAGE-BRIDGE.md`, `scripts/setup-mac-imessage-bridge.sh` | Local Messages on the Mac |
| **TMMT command watcher** | `~/projects/tmmt-agent-channel/imessage_command_watcher.py` | Owner commands starting with `TMMT` → agents |
| **Telegram owner bot** | `~/projects/tmmt-agent-channel/telegram_owner_bot.py` | Same grammar from Telegram |
| **Draft-first responder** | `~/.claude/skills/tg-responder/` | Inbox → classify → draft → **you approve** → send |
| **Owner voice ladder** | `docs/OWNER-VOICE-MODEL.md` | Learn → right hand → second-in-command |
| **Charter / compass** | `docs/HAILMARY-CHARTER.md`, `scripts/compass` | Protect first, fail closed, no secrets in git |
| **Command loop** | `~/.cursor/watchtower/command-loop.md` | Any device → router → agents / ops / brain |

**Gap:** none of the above yet treats **every inbound text** as brother-layer intake with per-contact voice learning. The watcher only reacts to `TMMT …` commands. tg-responder is Telegram-only and draft-first (good pattern to copy).

---

## Target shape (M1 at home)

```
Personal phone ──┐
Business phone ──┼──► Text forwarding / relay ──► Brainiac Messages
Anyone texts     ──┘         (+1 home line in .env)
       home number
              │
              ▼
    hailmary-inbox (SQLite, like tg-responder)
              │
    ┌─────────┴─────────┐
    │ Sender = owner?   │
    └─────────┬─────────┘
         yes  │  no
              ▼              ▼
      Brother mode      Contact profile
      (coach, sync,     (learn / draft / auto
       home ops)         per contact ladder)
              │              │
              └──────┬───────┘
                     ▼
              Draft → approve → send
              (never skip ladder without owner rule)
                     │
                     ▼
              Memory: `.hailmary/memory/` + vault
              Person notes: contact voice cards
```

**Carry M5:** SSH / Tailscale into Brainiac. Approve drafts from phone. Do not require Carry to stay awake for intake.

---

## Brother modes (three faces)

| Mode | When | Behavior |
|---|---|---|
| **Brother → you** | You text the home line or DM HAILMARY | No impersonation. Straight talk. Sync home business, back-burner list, today's move. |
| **Right hand → others** | Inbound from known contact, ladder &lt; auto | Draft reply in **your** voice for that contact. Push draft to you. Wait for approve / edit / skip. |
| **Stand-in → others** | Contact hit auto threshold **and** owner enabled | Send as you. Log everything. Kill-switch revokes instantly. |

Default for all new contacts: **observe + draft**. No auto until you say so per person.

---

## Contact voice card (per person)

Stored in gitignored `config/hailmary-brother.local.yaml` (see example). Fields:

- `relationship` — brother, sister, client, operator, vendor, family, other
- `register` — how you talk to them (short / formal / faith / street / business)
- `topics_ok` — what HAILMARY may discuss
- `never_say` — hard lines
- `ladder` — `observe` | `draft` | `auto`
- `approved_samples` — count of drafts you sent unchanged (unlocks auto if you enable)

Same idea as tg-responder `contacts:` block — already proven.

---

## Phone setup (owner clicks — not in repo)

**On Brainiac M1 (once):**

1. `bash scripts/swarm-join.sh --name brainiac-mac`
2. `bash scripts/hailmary booyah`
3. `bash scripts/setup-mac-imessage-bridge.sh` + Full Disk Access
4. Copy `config/hailmary-brother.example.yaml` → `config/hailmary-brother.local.yaml` (gitignored)
5. Set `HAILMARY_HOME_E164` in `.env` (your home line — do not commit)

**On iPhone(s):**

- Settings → Messages → **Text Message Forwarding** → enable Brainiac Mac
- Personal + business lines forward to the home number / Mac as you already do manually

**On Brainiac — always on:**

- FileVault on, no sleep (`docs/BRAINIAC-MAC-SETUP.md` keep-alive section)
- LaunchAgent for inbox watcher (same pattern as `run-telegram-owner-bot.sh`)

---

## Send ladder (non-negotiable)

| Level | Sends as Taha? | Requires |
|---|---|---|
| 0 Observe | No | New contact |
| 1 Draft | No — proposes | Default |
| 2 Draft + nudge | No — pings you on Carry | Urgent flag |
| 3 Auto template | Yes — fixed templates only | CROA-safe, no money promises |
| 4 Auto voice | Yes — learned voice | N approved drafts + owner toggle per contact |
| 5 Break-glass | Yes — full | Owner seal + explicit rule only |

Money, legal, access grants, deploy, kill-switch: **never above Level 1** without you typing yes.

---

## Sync / unison (home business first)

HAILMARY brother layer also tracks:

- **Home lane** — first business starts at home; open loops you paused for life cards
- **Back-burner queue** — one list in vault memory; weekly nudge, not guilt
- **Mission alignment** — ops commands still go through `TMMT ops` / `/api/ops/command` when you approve

Brother talks to the **online army** (agents, swarm) only through existing routers — no new backdoors.

---

## Build status (honest)

| Item | Status |
|---|---|
| Brainiac always-on + iMessage bridge docs | ✅ shipped |
| tg-responder draft queue pattern | ✅ shipped (Telegram) |
| Brother layer inbox on iMessage | 🔲 spec done — wire on M1 next |
| Personal/business forward automation | 🔲 owner phone settings + verify |
| Per-contact voice cards | 🔲 example config — fill locally |
| Auto-send per contact | 🔲 after learn ladder — off by default |

**Next safe build (on Brainiac):** `scripts/hailmary-brother/inbox-watcher.py` — poll Messages like tg-responder hook, write SQLite, draft only, notify Carry via Telegram or iMessage to owner handle.

---

## Quick verify (after M1 setup)

```bash
# On Brainiac
bash scripts/hailmary status
bash scripts/tmmt fix   # PASS/WARN/FAIL

# Text home line from your phone — should land in inbox DB (once watcher live)
# You should get a draft ping, not an auto-reply
```

---

_Companions: `docs/OWNER-VOICE-MODEL.md` · `docs/HAILMARY-CHARTER.md` · `docs/BRAINIAC-MAC-SETUP.md` · `docs/MOBILE.md` · `~/projects/tmmt-agent-channel/MESSAGING_GUIDE.md`_
