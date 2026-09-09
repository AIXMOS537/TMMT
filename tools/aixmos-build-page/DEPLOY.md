# AIXMOS Build Page — Go Live Guide

The build page is one self-contained `.html` file. It uses **hash routing** (`#/owner/build`),
so it needs **no server logic** to go online — any static host works, and the QR + share
links resolve the moment it's live.

---

## What works right now (no backend)

- **Per-build pages** — each operator's machine renders as its own page.
- **Scan to load** — the QR encodes the full build. Scanning opens the page and rebuilds that
  exact machine (modules, crew, cleared access).
- **Share link / Copy link** — same thing as a tappable link (`yoursite/#load=…`).
- **Save QR** — downloads the code as an image for a flyer, card, or phone wallpaper.
- **Saves per device** — builds persist locally on each device. The QR/link is how a build
  travels between devices, so no database is required for handoff.

The build code is just configuration — **not credentials, not personal data**. Nothing
sensitive is transmitted.

---

## Step 1 — Put it online (Vercel, ~5 min, free)

1. The file is already named `index.html`.
2. Point a static host at `tools/aixmos-build-page/` (or copy `index.html` into a tiny repo root).
3. Go to vercel.com → **Add New → Project** → import that repo → set the root directory to
   `tools/aixmos-build-page` → **Deploy**.
4. You now have a live URL like `aixmos-xxxx.vercel.app`. The QR codes already point at it.

> Netlify, Cloudflare Pages, and GitHub Pages all work the same way — it's a static file.

> Keep this separate from `tmmt-ops`, which is the one production app — see
> `docs/THREE-APP-ECOSYSTEM.md`. The build page is its own static deploy.

## Step 2 — Put your domain on it

1. In Vercel: **Project → Settings → Domains → Add** `aixmos.app`.
2. Vercel shows the DNS records to set (an A record or CNAME) at your domain registrar.
3. Add them, wait for it to verify. Now `aixmos.app` serves the page and every QR/link
   resolves to your brand.

---

## The recommended NEXT step (needs your accounts — flagged, not built)

To make `aixmos.app/{owner}/{build}` resolve to a **stored** page (clean URL, no long code in
the link, editable behind a login) — the full PinkSlips behavior — you add a small backend:

- **Store builds server-side.** You already run **Supabase** — one `builds` table
  (`owner_slug`, `build_slug`, `config_json`, `owner_id`) covers it.
- **Resolve the pretty URL.** A Vercel function reads `owner/build` from the path and returns
  the stored config; the page renders it.
- **Edit auth.** Only the owner (or you, the orchestrator) can change a build — gate writes
  behind a login so a public viewer can look but not alter.
- **Keep the gate honest.** The locked bays (Credit-to-Keys, Dispatch) stay UI gates.
  **Real CROA / licensing / insurance clearance still happens off-platform** — the unlock
  should be recorded, not treated as legal sign-off.

This is the only piece that touches your accounts, domain, and data handling, so it's the
right thing to do deliberately rather than wire blind. Say the word and I'll spec the
Supabase schema, the Vercel function, and the auth flow as a build packet.
