# Command Center — the console shell

`C:\Users\AIXMOS\CommandCenter` is the console every person at TMMT opens: the
owner's, each manager's, each operator's, and the home daily driver. They are
plain files with no build step, but they share a real shell underneath.

Four files own everything. Nothing else may redefine them:

| File | What it owns |
| --- | --- |
| `os/kernel.js` | The machine. Hardware detection and the effect budget. Stamps `<html>`. |
| `os/theme.js` | The colour. The per-role accent, and the rgba companions derived from it. |
| `os/command-engine.js` | The intent. Status machine, verbs, wake word, Ctrl+K palette. |
| `brand/console.css` | The surface. Layout and every gated effect. The only stylesheet. |

---

## 1. What is in here

| File | What it is |
| --- | --- |
| `CEO-Dashboard.html` | The owner console. |
| `Dashboard-Template.html` | The master. **The only place tiles are defined.** |
| `Dashboard-Sara-Example.html` | A worked example (role: operator). |
| `Home-Command-Center.html` | Home daily driver: family, friends, work. |
| `Prompt-Library.html` | Internal briefs. Extend-only, phased. |
| `Mission-Control-Preview.html` | Static June mock, kept for reference only. |
| `TeamDashboards/` | Generated, self-contained staff consoles. Never hand-edited. |
| `TeamDashboards/_onboarding/` | A blank operator console, rebuilt every run. |
| `TeamDashboards/_removed/` | Retired consoles, kept so people can be restored. |
| `tools/build-consoles.js` | Stamps the template into `TeamDashboards/`. |
| `tools/add-operator.js` | Adds one person and rebuilds. |
| `tools/serve.js` | Local static server for working on the shell. |
| `tools/profiles.json` | The roster. |
| `tmmt-site/` | The public site. Ships alone, carries a vendored copy of the kernel. |

**`tmmt-os/` and the Vercel deployments are out of scope for this shell.** The
production TMMT OS keeps its live Airtable-derived schema. The `--lux-*` tokens
in `tmmt-os/src/app/globals.css` stay opt-in and unused; never bind them to
`--primary`. Do not restyle production to match this console.

See also: [README-Dashboards.md](README-Dashboards.md) for giving someone a
console, and [ONBOARDING.md](ONBOARDING.md) for bringing an operator on.

---

## 2. Colour

Navy ground, per-role accent. This is the original Command Center scheme,
restored 2026-08-26 after a brief detour into black and gold.

| Token | Value | Job |
| --- | --- | --- |
| `--bg` / `--bg2` | `#0a0f1a` / `#0f1729` | the ground, with a radial lift at the top |
| `--card` / `--card-hover` | `#161f33` / `#1d2a45` | tiles |
| `--accent` | **per role** | primary tile, mic, focus ring |
| `--green` | `#3ddc97` | live / healthy / listening |
| `--amber` | `#ffc24b` | warning, and the GoHighLevel tiles |
| type | `"Segoe UI", system-ui, -apple-system` | no web font is ever fetched |

Role accents, from `os/theme.js`:

| owner | manager | dispatch | operator | sales | family | friend | vendor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `#4f8cff` | `#b794ff` | `#4f8cff` | `#3ddc97` | `#ffc24b` | `#ff8fab` | `#5ad1e6` | `#ffa94d` |

A page never hard-codes an accent. It calls `AIXOS.theme.apply(role, override)`,
which writes `--accent` plus the literal rgba companions `--accent-line`,
`--accent-fill`, `--accent-fill-strong`, `--accent-glow` and a lightened
`--accent-soft`.

**Do not reintroduce `color-mix()`.** The accent is dynamic, so its derived
values cannot be pre-written as literals in the stylesheet — which is exactly
why `theme.js` computes them. `color-mix()` is unsupported on Safari 16.x and
Chromium <111, both still in this fleet.

---

## 3. Hardware

One set of files has to be right on a 2013 shop PC, a Ryzen tower, a gaming
laptop and an M-series Mac, without anyone picking a "low graphics mode".

**Cheap signals**, read synchronously before first paint: `hardwareConcurrency`,
`deviceMemory`, `devicePixelRatio`, platform, `prefers-reduced-motion`,
`prefers-reduced-transparency`, `forced-colors`, `(update: slow)`,
`connection.saveData`.

**GPU**, probed on idle and cached per machine:
`WEBGL_debug_renderer_info` → `UNMASKED_RENDERER_WEBGL`.

**Measured frames**, after load: ~45 rAF frames. Under 42 fps the machine drops
a tier regardless of what the heuristics said.

| Silicon | Class | Typical tier | Notes |
| --- | --- | --- | --- |
| NVIDIA GeForce / RTX / Quadro | discrete | full | Everything on. |
| AMD RX / Radeon Pro / Navi | discrete | full | Same. |
| AMD Vega / Radeon Graphics (APU) | integrated | standard | Needs 8 cores + 8 GB for full. |
| Intel Arc A-series | discrete | full | Treated as discrete. |
| Intel Iris / UHD / HD Graphics | integrated | standard → lite | Pre-Skylake HD parts scored down again. |
| Apple M-series | integrated | full | Integrated by construction, discrete by performance. |
| Apple A-series (iPhone / iPad) | integrated | full / standard | Same path, then measured. |
| Adreno / Mali / PowerVR | mobile | standard | Capped — never reaches full. |
| SwiftShader / llvmpipe / RDP / VM | software | lite | Capped hard. Software outranks any vendor string it names. |
| No WebGL at all | software | lite | Treated as the weakest case. |

| Tier | Gets |
| --- | --- |
| `full` | shadows, gold-free accent glow, blurred palette backdrop, spring motion |
| `standard` | shadows, spring motion, the listening pulse |
| `lite` | flat opaque cards, no transitions, no pulse, no gradient ground |

The kernel writes `data-tier` and `data-effects` on `<html>`. **CSS never opts
itself in.** If `os/kernel.js` fails to load, no attribute exists, every gate
misses, and the console renders flat but complete — the safe direction to be
wrong in.

**Overrides.** The `graphics` chip in the status bar cycles
`auto → lite → standard → full`; so does the `graphics` verb. A pin is stored in
`localStorage` and outranks every heuristic *and* every measurement. `status`
reads the machine out loud.

---

## 4. The laws

Settled. A later pass extends them; it does not relitigate them.

1. **One stylesheet.** A page that declares its own `:root` or pastes a second
   copy of the tokens is a regression. That is how the palettes drifted apart.
2. **One accent source.** `AIXOS.theme.apply(role)`. Never a hard-coded hex in a
   page, never a second copy of the role map.
3. **Amber is the warning** and the GoHighLevel tiles. Green is live/healthy.
   Neither is ever repurposed as decoration.
4. **Unknown input returns the verb list.** It never dumps the user into a web
   search. Searching is its own verb, spoken on purpose: `search <thing>`.
5. **Voice cannot reach the machine.** Shutdown, reboot, format, wipe, delete,
   `rm -rf`, disabling security software — refused before matching, not after.
6. **Voice is primary; the palette and mouse are fallbacks that always exist.**
   Ctrl+K opens the palette, `/` focuses it, Shift+Space talks, Esc stops both
   listening and speaking.
7. **Speaking is interruptible.** New input cancels it immediately.
8. **No effect outside a gate.** Any blur, shadow, animation or transition
   declared outside `html[data-effects~="..."]` is a dropped frame on someone's
   machine.
9. **No web fonts.** Staff laptops go offline and staff files get emailed.
10. **No `color-mix()`.** See section 2.
11. **Extend-only.** Continue from the current phase. Do not rewrite working
    architecture.

---

## 5. Phases

```
Phase 1  Foundation ....... DONE  os/kernel.js — capability tiers, GPU class, frame demotion
Phase 2  Brain ............ DONE  os/command-engine.js — states, verbs, palette, wake word
Phase 2b Theme ............ DONE  os/theme.js — the per-role accent, one copy
Phase 3  Knowledge ........ OPEN  live ops verbs against TMMT data
                                  (summary / assign_staff / assign_vendor / advance_case /
                                   approve_sync / post_ledger), each returning typed results
Phase 4  Surfaces ......... OPEN  per-zone treatments beyond the three on the home screen
Phase 5  Bridge ........... OPEN  local loopback API, execFile-only, dual-display
```

Phase 3 is the next real unit of work. It needs an authenticated read path to
TMMT data; until that exists the engine correctly answers "not a known command"
rather than guessing.

---

## 6. Working on this

The pages are plain files, but the relative `os/*.js` includes need an http
origin:

```bash
node tools/serve.js
```

Then open <http://127.0.0.1:8899>.

Staff consoles in `TeamDashboards/` are **generated and self-contained** — the
kernel, theme, engine and stylesheet are inlined so a single file works off a USB
stick. After changing anything in `os/`, `brand/console.css` or
`Dashboard-Template.html`, restamp them:

```bash
node tools/build-consoles.js
```

And re-vendor the public site's copy of the kernel:

```bash
cp os/kernel.js tmmt-site/js/kernel.js
```

Keep source files LF. The generator normalises the template before matching, but
a CRLF save elsewhere will still bite.

Before shipping a console, run the **Surface audit** brief in
`Prompt-Library.html`. It checks the failure modes that have actually happened
here: a second stylesheet, a hard-coded accent, amber reused as decoration, a
tile silently dropped by a guard clause, unknown voice input falling through to
search, an ungated effect, a compatibility gap, and a page that renders nothing
with script disabled.
