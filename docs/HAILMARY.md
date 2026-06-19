# HAILMARY — your local agent across every device

HAILMARY runs on your **work Mac**, **carry Mac**, and **iPhones** and keeps them
in sync. The secret: they don't talk to each other directly — they all read/write
**one shared brain** (the Memory Fabric `/api/memory`) over your **Tailscale
mesh**. Write a note on one device, read it on another. That's the sync.

```
 work Mac ─┐
 carry Mac ─┼──Tailscale──►  THE BRAIN  (/api/memory on Brainiac or cloud)
 iPhone(s) ─┘                 memory_events · memory_facts · entities
```

## Prerequisites (once)
1. **Tailscale** on every device (Macs + iPhones), all on the same tailnet, MagicDNS on.
2. The brain reachable on the tailnet — e.g. `https://brainiac.<tailnet>.ts.net/api/memory`
   (run the app on Brainiac + `tailscale serve`; see `docs/MEMORY-MESH-ACCESS.md`).
3. The app's `MEMORY_API_TOKEN` value (same token every device uses).

## Mac setup (work + carry)

Run on **each** Mac, from the repo:

```bash
# work Mac (also becomes the iMessage texting assistant):
bash scripts/hailmary-setup.sh --role work \
  --brain-url https://brainiac.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>

# carry Mac:
bash scripts/hailmary-setup.sh --role carry \
  --brain-url https://brainiac.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
```

What it does: installs Homebrew/node/uv/jq + Claude Code, writes
`~/.hailmary/config.env` and the `HAILMARY.md` operating rules, installs the
`hailmary` CLI to `/usr/local/bin`, and registers MCP servers for local Claude
Code — the **memory bridge** on both, plus the **Mac iMessage bridge** on the
work Mac (so HAILMARY can text from your work cell). The work Mac needs **Full
Disk Access** for Messages (the script reminds you).

### Use it
```bash
hailmary status                         # brain reachable?
hailmary recall "John Lopez"            # what does the brain know?
hailmary remember "ordered 2 tires for unit 7"
hailmary note carry-mac "grab the contract on your way"
hailmary inbox                          # notes left for THIS device
```
Inside local Claude Code on either Mac, HAILMARY also has `recall`/`remember`
MCP tools (and `messages` on the work Mac) — so it follows the discipline in
`~/.hailmary/HAILMARY.md`: recall → act → remember.

## iPhone setup (both phones)

iPhones can't run MCP servers — they reach the same brain over Tailscale via a
tiny **Apple Shortcut**.

1. Install **Tailscale** from the App Store, sign in, join the tailnet.
2. New **Shortcut → "HAILMARY Remember"**:
   - **Ask for Input** (Text) → "What should I remember?"
   - **Get Contents of URL**:
     - URL: `https://brainiac.<tailnet>.ts.net/api/memory`
     - Method: `POST`
     - Headers: `Authorization: Bearer <MEMORY_API_TOKEN>`, `Content-Type: application/json`
     - Request Body (JSON):
       `{ "op":"remember", "action":"note", "source":"agent", "actorKind":"owner",
          "actorLabel":"HAILMARY@iphone", "summary": <Provided Input> }`
   - (Optional) Show Result.
3. Duplicate it as **"HAILMARY Recall"** — change `op` to `"recall"` and use
   `"query": <Provided Input>`.
4. Add both to the Home Screen / Back-Tap / "Hey Siri, HAILMARY Remember".

Now the phone writes to and reads from the very same brain as the Macs.

## How the devices "talk to each other"
- **Shared state:** anything any node `remember`s, every node can `recall`.
- **Directed notes:** `hailmary note <node> "…"` (or a Shortcut) tags a note for a
  device; that device sees it with `hailmary inbox`.
- **Escalation to you:** server-side routing already pings your **work cell**
  (working hours, via the Mac iMessage bridge) and **never** your personal line.

## Rules HAILMARY follows
- "Hailmary" = **you**, the owner; the agent acts for you, never as you.
- **Never** contact the personal line (+1 PHONE-REDACTED).
- Reach you on the **work cell** (+1 PHONE-REDACTED) during working hours.
- Recall before acting; remember after. The brain is the single source of truth.

## Security notes
- The brain is exposed **only** over Tailscale — never public.
- `MEMORY_API_TOKEN` lives in `~/.hailmary/config.env` (chmod 600) and in the
  Shortcut; treat it like a password. Rotate it by updating the app env + each device.
- The Mac iMessage bridge reads your Messages DB — keep it on the work Mac only
  (or behind Tailscale), per `docs/MAC-IMESSAGE-BRIDGE.md`.
