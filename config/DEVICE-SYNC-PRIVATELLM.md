# Device Sync — Private LLM + Shortcuts over the Tailnet

> Keep all four Apple devices — **carry Mac, carry iPhone, work Mac, work iPhone**
> — always in sync for AI capture/automation, even though the work devices are on
> a **separate Apple ID**. The sync fabric is the **Tailscale tailnet + the NAS
> `/AIXMOS/` share**, not iCloud (iCloud can't cross the Apple-ID boundary; the
> tailnet can).
>
> Grounded in the AIXMOS Master Project File (§1 the mesh, §8 next-action #6).

_Status: SPEC + buildable Shortcut recipes. Setup runs ON each device (a cloud
session can't reach them); this is the exact recipe each device follows._

---

## 1. Why not iCloud

| | iCloud / native Shortcuts sync | Tailscale tailnet (this plan) |
|---|---|---|
| Same Apple ID | auto-syncs | works |
| **Different Apple ID (your work devices)** | **does NOT sync** | **works — per-device, ID-agnostic** |
| Offline | n/a | Private LLM on-device still runs |

So: the **Shortcuts logic** is installed per device (share via iCloud link or
rebuild — it doesn't need to auto-sync), and the **data** they read/write lives on
the shared tailnet store. That store being shared = the devices are "in sync."

## 2. The pieces (from the Master File §1)

| Node | Role in this sync |
|---|---|
| **Carry Mac (M5)** | **Brain hub** — Ollama `qwen2.5:14b` at `http://<carry-mac-tailnet-ip>:11434`, tailnet-only. Heavy/accurate inference + writes the shared state. |
| **Carry iPhone** | Capture + remote. Private LLM (Qwen 4B) for offline; Shortcuts hit the hub when on tailnet. |
| **Work Mac** | Same Shortcuts; second workstation node on the tailnet. |
| **Work iPhone** | Same as carry iPhone (separate Apple ID — bridged by Tailscale). |
| **UGREEN NAS** | File tier — the shared store at `/AIXMOS/sync/` (inbox, context, log). |
| **Supabase** | Structured mirror (capture rows, parsed events) for the web mesh + dashboards. |

## 3. One-time setup per device

1. **Tailscale** installed + signed into the **same tailnet** on all 4 devices
   (and the NAS). Confirm each can reach the carry-Mac hub: `http://<carry-mac-tailnet-ip>:11434/api/tags`.
2. **Private LLM** app installed on both iPhones (and optionally the Macs) with a
   Qwen model downloaded — this is the offline brain.
3. **NAS share** reachable over tailnet. Create `/AIXMOS/sync/` with:
   `inbox/` (new captures), `context.md` (rolling shared context), `log.ndjson` (audit).
4. **Shortcuts** (below) added on each device. On the work Apple ID, import via the
   iCloud share link the carry devices generate, or rebuild from these steps.

## 4. The Shortcuts to build

Pattern for all: **try the hub over tailnet; if unreachable, fall back to the
on-device Private LLM; always write the result to the shared store.**

### A. Schedule-Parser  (Master File next-action #6)
Dictate → structured event → Calendar + Reminders → shared log.
```
1. Dictate Text  (or Shortcut Input from Share Sheet)
2. Text → prompt: "Extract calendar events as JSON {title,start,end,location,notes} from: <dictation>"
3. Get Contents of URL
     POST http://<carry-mac-tailnet-ip>:11434/api/generate
     JSON: { "model":"qwen2.5:14b", "prompt": <prompt>, "stream": false, "format":"json" }
   If it errors (off tailnet) → Run Private LLM action with the same prompt (on-device).
4. Get Dictionary from JSON → Add New Event (Calendar) + Add Reminder
5. Get Contents of URL → append the JSON line to NAS /AIXMOS/sync/log.ndjson
   (and POST to Supabase capture endpoint for the web mesh)
6. Show Notification "Scheduled: <title>"
```

### B. Capture → Mesh  (universal inbox)
Any note/voice/photo-text → hub summarizes → written to shared inbox so **every**
device sees it.
```
1. Shortcut Input (Share Sheet: text/voice/photo)
2. (photo → Extract Text)
3. POST to hub /api/generate: "Summarize + tag this capture as JSON {summary,tags,action}"
   fallback → Private LLM on-device
4. Append to NAS /AIXMOS/sync/inbox/<timestamp>.json  + Supabase
5. (optional) POST to Slack #new-channel via webhook
```
Trigger: Share Sheet + a Personal Automation (e.g., on "Hey Siri, capture").

### C. Daily Brief  (pull, keeps you current)
```
Personal Automation: Time of Day 7:00am
1. Get Contents of URL: GET hub /brief  (or Supabase brief row)
2. Show Notification + Speak Text
```

### D. Sync-Pull  (make the shared context available to the local model)
```
Personal Automation: When app "Private LLM" is opened (and hourly)
1. GET NAS /AIXMOS/sync/context.md
2. Save to Private LLM's working note / set as system context
   → on-device model now answers with the latest shared context = in sync
```

## 5. How "always in sync" actually holds

- **Write-through:** every capture writes to the shared store (NAS + Supabase), so
  whichever device you grab next reads the same truth.
- **Read-on-open:** Sync-Pull refreshes each device's local context from the store.
- **Tailnet bridges the Apple-ID gap:** work devices reach the same hub + NAS as
  carry devices without sharing an Apple ID.
- **Offline-safe:** no tailnet → Private LLM answers locally; the write queues to
  the NAS next time it's reachable (Shortcuts: write to local file, a Folder
  Automation syncs when back on tailnet).

## 6. Guardrails

- Hub + NAS are **tailnet-only** — never port-forward them to the public internet.
- Outbound actions (sending a message, creating real calendar invites for others)
  follow the mesh rule: **draft → owner approval** (`docs/MESH-COORDINATION.md §4`).
- Keep any Supabase/Slack token used by a Shortcut in that device's keychain, not
  in the Shortcut body.

## 7. What needs YOU (on-device — can't be done from cloud)

1. Confirm all 4 devices + NAS are on the same tailnet; note the carry-Mac tailnet IP.
2. Run `aixmos_carrymac_hub.sh` so Ollama is serving (Master File next-action #1).
3. Build Shortcut **A** first (schedule-parser) on the carry iPhone; test; share the
   iCloud link to the other 3 (rebuild on the work Apple ID if the link won't import).
4. Create `/AIXMOS/sync/` on the NAS.
5. Tell me your hub's tailnet IP + whether you want the Supabase mirror, and I'll
   generate the exact `/api/generate` + Supabase request bodies (and a `/brief`
   endpoint) ready to paste into the Shortcuts.

---

_See also: `docs/MESH-COORDINATION.md` (the agent mesh these devices belong to),
the AIXMOS Master Project File (NAS `/AIXMOS/master/`)._
