# The Wiki Dropdown Method — your home base (kill Obsidian)

> Plain markdown is the brain; a single collapsible **dropdown page** is the
> face. No Obsidian, no lock-in, no sync drama. Git is the only moving part.

## Why (the honest case)

Obsidian is a heavy app with its own layout, plugins, and a vault format. For
managing + syncing + flash-deploying **many projects across many machines and
people**, that's friction. The approach Karpathy popularized is simpler and
LLM-native:

- **Knowledge = plain markdown files.** An LLM reads them perfectly, git diffs
  them, and they open anywhere. No app required.
- **Navigation = collapsible `<details>` dropdowns.** One page can hold a *lot*
  without drowning you — open only what you need. Works natively in any browser
  and renders on GitHub.
- **One file / one page is the home base.** Not a sprawling vault — a single
  entry point you (and any operator) land on.

So: **markdown is the source of truth; the wiki page is the generated view.**
Delete nothing of value — your HAILMARY memory snapshots stay markdown; you just
stop *living* in Obsidian and live in this instead.

## What you get

| Piece | What | Where |
|---|---|---|
| **Wiki reader** | Offline HTML home base — a sidebar of every doc + the **full rendered content inline** (headings, tables, code, dropdowns) + full-text search. A complete reader; **Obsidian not needed for anything.** | `tools/wiki/index.html` |
| **Renderer** | Node build that converts every markdown doc → HTML and embeds it (no deps, no internet, no fetch) | `tools/wiki/build.mjs` |
| **Generator** | Rebuilds the reader from `docs/` in one command | `scripts/wiki` |
| **Cockpit link** | The 3D cockpit and the wiki link to each other | both `tools/` pages |

**Why it fully replaces Obsidian:** it *renders* the markdown (not just links to
it) — read everything in the browser, search the full text, follow links, expand
`<details>`. The markdown files stay the editable source (any text editor / VS
Code); the reader is the view. No vault, no plugins, no app.

## Use it

```bash
bash scripts/wiki            # build + open your home base in the browser
bash scripts/wiki build      # just regenerate (after adding/editing docs)
bash scripts/hologram        # the 3D cockpit (the WIKI button jumps here ↔)
```

- **Offline + plug-and-play.** The wiki needs no internet and no deps — any
  machine with the repo can open it. (The 3D cockpit needs internet for its
  engine; the wiki does not.)
- **Search** filters every card live; **dropdowns** group HOME BASE (pinned) +
  ALL DOCUMENTATION.
- **Add a project doc** → drop a `something.md` in `docs/` → `bash scripts/wiki
  build` → it appears. To pin it to HOME BASE, add a line to `HOME_PINS` in
  `scripts/wiki`.

## The authoring convention (so it scales across projects)

Write every doc so the generator + an LLM both get the gist instantly:

1. **First line is the H1 title:** `# Project / Thing`.
2. **Second block is a one-line blockquote summary:** `> what this is, in a
   sentence.` (The generator uses this as the card blurb.)
3. **Use `<details>` for depth inside a doc** when it gets long:
   ```markdown
   <details><summary>Deploy steps</summary>

   1. …
   2. …
   </details>
   ```
   Collapsed by default, an LLM still reads it, and the page stays scannable.

## Make it the home base on every machine (M1 + Windows + operators)

Because it's just files in the repo, **git is the delivery**:

```bash
# on the M1, the Windows box, any operator machine:
git pull
bash scripts/wiki            # opens the same home base
```

- **Set it as the browser home page** (or a Chrome/Edge "app" shortcut) so it's
  the first thing on screen instead of Obsidian.
- **Flash-deployable:** a new machine clones the repo (or runs the Operator
  Portable Kit), and the wiki + cockpit are just *there* — same home base for
  everyone, no per-app setup.

> This implements the **spirit** of the markdown + collapsible-dropdown wiki
> Karpathy uses. If you have a specific repo/reference in mind, point me to it
> and I'll match it exactly.
