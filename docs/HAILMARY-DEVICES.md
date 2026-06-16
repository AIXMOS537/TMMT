# HAILMARY on every device — the multi-device user agent

One agent, one brain, every screen. All devices sync through the shared brain
(`/api/hailmary` + `/api/memory`) over your **Tailscale mesh** — write on one,
read on another. There's no device-to-device pairing; the brain *is* the sync.

## The universal surface
- **Web console:** open **`/hailmary`** in ANY browser (built remote/D-pad
  friendly). Enter your access token once (stored on that device). Buttons:
  **Ask** (operative answer, local-first AI), **Recall**, **Remember**.
- **API:** `POST /api/hailmary` (Bearer `MEMORY_API_TOKEN`), ops `ask|recall|remember`.
- Host it on Brainiac and `tailscale serve` it → reachable from every device,
  never public.

## Per device (how each connects)

| Device | How HAILMARY runs there | Notes |
|---|---|---|
| **Mac / Windows / Linux** | `hailmary` CLI + MCP in Claude Code | Full power: `do`, `recon`, `brief`, notes. Setup: `scripts/hailmary-setup.sh`. |
| **iPhone / iPad** | Apple Shortcut → `/api/hailmary`, or open `/hailmary` in Safari (Add to Home Screen) | Voice via "Hey Siri, HAILMARY". |
| **Android phone/tablet** | Open `/hailmary` (Add to Home Screen), or HTTP Shortcuts/Tasker → API | Same brain. |
| **Amazon Fire Stick / Fire TV** | Open `/hailmary` in the **Silk browser** (Fire OS is Android) | D-pad-friendly buttons. For voice: an **Alexa skill** that calls `/api/hailmary` (Echo/Fire). |
| **PlayStation (PS5/PS4)** | Open `/hailmary` in the console **web browser** | Consoles are locked down — no apps/Tailscale; the **browser console is the path**. Reach it via a Cloudflare Tunnel URL or your tailnet if the console is on it. |
| **Smart TV (Samsung/LG/Google TV)** | Open `/hailmary` in the TV browser; Google TV can also sideload the web app | Big-button UI fits the remote. |
| **Echo / Google Home (voice only)** | Alexa skill / Google Action → `/api/hailmary` | Pure voice in/out. |

## Honest limits (and the workaround)
- **Consoles (PS5) and Fire TV can't run a true background agent** — they're
  sealed. The **browser console** (`/hailmary`) is the real, supported way in,
  and it's a full assistant (ask/recall/remember against the live brain).
- **Voice on Fire/Echo** needs a small **Alexa skill** (a thin proxy to
  `/api/hailmary`) — a clean next build if you want hands-free.
- Anything with a browser is now a HAILMARY node. That genuinely makes it a
  multi-device user agent: the PS5, the Fire Stick, your phone, and your Mac all
  talk to the same brain and see each other's notes.

## Install it like a native app (PWA — works on any device)
`/hailmary` is now an installable PWA (`src/app/manifest.ts` + `public/hailmary-sw.js`):
- **Android / Chrome / Edge / desktop / Chromebook / Google TV:** open `/hailmary`
  → browser shows **Install** (or menu → "Install app" / "Add to Home Screen").
  Launches standalone, full-screen, with the HAILMARY icon.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.
- **Fire Tablet / Fire TV (Silk):** menu → Add to Home Screen / bookmark.
- It caches the shell, so it opens instantly and survives a brief network blip.

## Voice on screenless devices (Echo / Fire) — Alexa skill
`scripts/hailmary-alexa-skill.mjs` is a ready thin-proxy handler:
1. Alexa Developer Console → new custom skill → invocation name "hailmary".
2. Add intent **AskIntent** with slot `{query}` (type `AMAZON.SearchQuery`),
   sample utterance: `ask {query}`.
3. Backend = deploy the script as a Lambda (Node 18+) or any HTTPS endpoint; set
   env `HAILMARY_API_URL` (`…/api/hailmary`) + `HAILMARY_API_TOKEN`.
4. "Alexa, ask hailmary what's my brief" → operative answer, local-first AI.

## Security
- Reachable **only over Tailscale** (or a locked Cloudflare Tunnel) — never open
  to the public internet.
- The token lives on each device (localStorage / Shortcut / skill secret); treat
  it like a password and rotate by changing `MEMORY_API_TOKEN` + each device.
- The personal phone line stays `do_not_contact`; devices read/write the brain,
  they don't bypass the channel rules.

## Quick start on a new device (e.g., the Fire Stick)
1. Make sure the brain is reachable (Brainiac + `tailscale serve`, or a Tunnel URL).
2. On the device browser, go to `https://<brainiac-or-tunnel>/hailmary`.
3. Open **Device setup**, paste the token, name the device (`firestick`), Save.
4. Tap **Ask** / **Recall** / **Remember**. It's now a synced HAILMARY node.
