# The Architect's Cockpit — go virtual

> Your empire as a holographic engine you can rotate, zoom, and **pick apart
> node-by-node like a car at a junkyard.** Built to run on the carry Mac today,
> and to graduate to real spatial/AR (Vision Pro / WebXR) tomorrow.

## Open it (carry Mac)

```bash
bash scripts/hologram          # opens tools/hologram-cockpit/index.html in your browser
```

- **Drag** (two-finger) = orbit · **scroll/pinch** = zoom · **click any glowing
  node** = dissect it (a panel slides in with its guts) · **ESC** = close.
- **AUTO-ORBIT** / **RESET VIEW** buttons top-right.
- Needs internet (loads three.js from a CDN); 100% local otherwise — no data
  leaves the machine.

## What you're looking at

| Color | Layer |
|---|---|
| 🔵 Cyan / violet / gold core | **The brains** — `brainiac-mac` (primary), `brainiac-win` (backup), `carry-m5` (you) |
| 🟡 Gold ring | **The 6 verticals** — rentals, credit guidance, funding, marketing, e-commerce, creator |
| 🟢 Green | **Operators** — flagship (TMMT, MOE LEGACY) + $97/mo seats, orbiting their vertical |
| 🟣 Magenta tower | **The value ladder** — $97/mo → $100K, the climb |

Every node is **data-driven** — edit the `EMPIRE` object at the top of
`tools/hologram-cockpit/index.html` and the scene rebuilds. Add an operator, a
vertical, a price — it shows up in 3D.

## How this becomes *actual* holograms (the honest path)

What ships today is **WebGL** — true real-time 3D you fly through with the
trackpad, with a holographic bloom look. It is **not** a literal floating-air
hologram (that needs hardware). The upgrade path is real and short:

1. **Now:** WebGL in the browser (this). Runs on every device you own.
2. **Spatial/AR:** the same three.js scene drops into **WebXR** — add an
   `XRButton` and it renders in **Apple Vision Pro / Quest** as a room-scale
   hologram you reach out and grab. Same data, same code, ~30 lines added.
3. **Live brain:** wire the `EMPIRE` data to the real system (operators from
   `scripts/member`, fleet from `FLEET-ROSTER`, presence from
   `scripts/mesh/presence.sh`) so the cockpit is a **live** map — nodes pulse
   when an operator is online, go dark when a brain drops.

I can build steps 2 and 3 on request.

## The cross-operator brain (what powers the dissection)

The cockpit is the **face**; the **brain** behind it is the AIXMOS shared-learning
LLM. The vision you described — "best LLM for any business, programmed + learns
online + across all operators":

- **Programmed knowledge:** each node carries the SOPs, playbooks, and pricing
  already in this repo (the panels you click are the first slice of that).
- **Local-first models:** `scripts/setup-llm.sh` already gives every machine its
  own local LLM sized to its RAM (the private brain per node).
- **Cross-operator learning (to build):** a shared knowledge layer where wins,
  scripts, and patterns from one operator's vertical raise every operator —
  **without leaking one operator's customer data to another** (that's the same
  tenancy-isolation wall flagged in `HOMELAND-HQ-AND-OPERATOR-SEATS.md`: shared
  *lessons*, isolated *data*).
- **Honest line:** "learns online across the board" = a curated, owner-governed
  knowledge base + retrieval, not scraping or selling anyone's data. The value is
  the **network effect of playbooks**, kept compliant (credit = "guidance").

_Companions: `docs/HOMELAND-HQ-AND-OPERATOR-SEATS.md`, `docs/FLEET-ROSTER.md`,
`docs/OFFER-STACK.md`, `docs/DMV-CLUBHOUSE-OFFICE.md`._
