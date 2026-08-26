# Command Center consoles — how to give one to anyone

Everyone gets the same console: the same surface, the same command engine, and
the same hardware adaptation. They only see the tiles their **role** allows, and
each role carries its own accent colour.

For the shell itself — colour law, hardware matrix, phases — read [OS.md](OS.md).
For bringing a new person on, read [ONBOARDING.md](ONBOARDING.md). This file is
the day-to-day "give someone a console" guide.

## Files

- **CEO-Dashboard.html** — your own (role: `owner`, sees everything). Don't hand this out.
- **Dashboard-Template.html** — the master. **This is the only place tiles are defined.**
- **Dashboard-Sara-Example.html** — a finished example (an operator).
- **TeamDashboards/** — everyone's console. **Generated. Do not hand-edit these.**
- **TeamDashboards/_onboarding/** — a blank operator console, always current.
- **TeamDashboards/_removed/** — retired consoles, kept so people can be restored.
- **tools/profiles.json** — the roster: who exists, and their role.
- **tools/build-consoles.js** — stamps the template out into TeamDashboards/.
- **tools/add-operator.js** — adds one person and rebuilds, in one command.

## Make a new one

```bash
node tools/add-operator.js "Sara Ahmed"
```

That adds her to the roster, rebuilds every console, and prints the file to hand
over. Pass a role as the second argument for anything other than an operator:
`node tools/add-operator.js "Dev Patel" dispatch`.

To change someone who already exists, edit `tools/profiles.json` by hand and run
`node tools/build-consoles.js`.

Then send them `TeamDashboards/Dashboard-Sara-Ahmed.html`. That single file is
**self-contained** — the kernel, the theme, the command engine and the whole
stylesheet are inlined, so it works from a USB stick, an email attachment, or a
desktop with nothing else next to it.

To change a link **for everyone at once**, edit the `SECTIONS` catalog in
`Dashboard-Template.html` and re-run the build. Nothing is copy-pasted any more.

## Roles — who sees what

| Role | Sees | Hidden |
|------|------|--------|
| **owner** | Everything | — |
| **manager** | All operations + Billing, Notion, Slack | Stripe, Supabase, Vercel, GitHub, Investor, Local dev |
| **dispatch** | Briefing, Dispatch, Cases, Agency, Operators, GHL convos/calendar, Slack, Assistant | Money + infra |
| **operator** | Briefing, Dispatch, Cases, Calendar, Assistant | Everything else |
| **sales** | Briefing, Marketplace, all GoHighLevel, Intake, Assistant | Ops admin + infra |
| **family / friend / vendor** | Personal links only (Message you, plus any links you add) | All business tiles |

> The owner-only tiles (Stripe, Supabase, Vercel, GitHub, Investor) are **never**
> shown to anyone but you. The Cursor and Prompt Library tiles are stripped out
> of handouts entirely by the build.
>
> A console grants **nothing**. It is a page of links; every system behind it has
> its own account. Removing someone here does not revoke their access — see
> [ONBOARDING.md](ONBOARDING.md) §4.

## Add personal links for someone

Fill in `extraTiles` in their `tools/profiles.json` entry — these show at the top
under "Your links". Each entry is the literal tile object, as a string, which the
build drops straight into the file:

```json
"extraTiles": [
  "{ icon: \"📅\", label: \"Our Calendar\", sub: \"shared\", href: \"https://calendar.google.com/...\" }"
]
```

This is how family, friends and vendors get a useful console.

## Commanding a console

Three ways in, one engine behind all of them:

- **Voice** — tap the mic, say a tile name ("dispatch", "calendar").
  Tap **Hands-free**, then say **"Nexus …"** to run without touching anything.
  Needs Microsoft Edge or Chrome; the first use asks to allow the microphone.
- **Palette** — **Ctrl+K** (⌘K on a Mac) opens the command palette. Type a verb
  or a page name, arrow keys, Enter. `/` also opens it. This always works, on
  every browser, with no microphone.
- **Mouse** — click a tile.

Verbs: `help`, `open`, `search`, `ask`, `graphics`, `status`, `stop`.

- Say something the console doesn't know and it **tells you the verbs**. It will
  not silently throw you at a web search — that is what `search <thing>` is for.
- `ask <question>` goes to the TMMT Assistant (staff roles only).
- **Esc** stops both listening and speaking. Speaking is always interruptible.
- The console will not shut down, restart, format or delete anything. Those
  phrases are refused outright — voice cannot reach the machine.

## Graphics on slow machines

Every console detects the machine it opened on — CPU, memory, GPU vendor
(Intel / AMD / NVIDIA / Apple), and the frame rate it actually achieves — and
turns effects down to match. Nobody has to configure anything.

The status line under the mic shows what it decided, e.g.
`IDLE · INTEL · 4 CORES · 16 GB · STANDARD GRAPHICS`.

If a machine still feels slow, click **graphics** in that line (or say
`graphics lite`) to cycle `auto → lite → standard → full`. A manual choice is
remembered on that machine and overrides the automatic one; `graphics auto`
hands control back.

Say `status` and the console reads the machine out loud.

## Notes

- **Colour changes per role.** Owner and dispatch blue, manager violet, operator
  green, sales amber, family pink, friend cyan, vendor orange. Set `"accent"` in
  a profile to override one person. The map lives in `os/theme.js` — one copy,
  never pasted into a page.
- Consoles work offline for local tiles; remote tiles obviously need a network,
  and the status line says `offline` when there isn't one.
- With JavaScript disabled, a console still shows a short list of direct links
  rather than a blank page.

## Working on the shell itself

```bash
node tools/serve.js
```

Then open <http://127.0.0.1:8899>. The `os/*.js` includes are relative, so the
non-generated pages need an http origin — the generated handouts do not.

After changing anything in `os/`, `brand/console.css` or
`Dashboard-Template.html`, **re-run `node tools/build-consoles.js`**, or the
handouts keep the old copy. Also re-vendor the public site's kernel:

```bash
cp os/kernel.js tmmt-site/js/kernel.js
```
