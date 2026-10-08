# TMMT-AI-RUNTIME — Design

Date: 2026-05-22

## Summary

A small, cross-platform Node.js CLI (`tmmt`) that acts as a unified launcher for
the AIXMOS agents across the owner's three machines. It is a thin control layer:
it wraps `AIXMOS-AGENTS`, resolving the correct Ollama backend per device and
launching agents with one command everywhere. It does not replace or modify the
agent code — the only artifact it adds to the `AIXMOS-AGENTS` repo is a single
manifest file.

## Goal

Give the owner one command — `tmmt` — that works identically on every machine,
shows a numbered menu of available AIXMOS agents, and runs any agent directly by
name. The launcher knows which machine it is on and wires each agent to the right
local Ollama backend, hiding agents that cannot run on the current device.

## Scope (v1)

**In scope:**

- A Node.js CLI launcher that runs natively on macOS and Windows.
- An interactive numbered menu (bare `tmmt`) and direct subcommands (`tmmt jarvis`).
- Per-device configuration written once by a setup script.
- Per-device Ollama backend wiring.
- Hiding agents that require Docker on machines where Docker is not installed.

**Out of scope (explicitly deferred):**

- The brain-dump → ClickUp agent (`AIX-Command-Center`).
- Starting the Docker infrastructure stack from the launcher.
- A health-check / doctor command.
- Scanning the home directory to build an inventory.
- NAS integration and the `TMMT_NAS_PATH` / `TMMT_ENV` environment variables.

These were implied by an earlier draft set of setup steps but are not part of an
agents-only v1. The design keeps the agent list data-driven so additions like the
brain-dump agent slot in later without a launcher rewrite.

## Relationship to other specs

This is a sibling of `2026-05-22-portable-ai-fleet-flash-design.md` (the
portable-fleet / flash-drive distribution design). That spec governs how kits are
synced across machines and drives; this spec governs the per-device launcher. The
two share machine roles:

| Role    | Machine                | OS      | Notes                                      |
|---------|------------------------|---------|--------------------------------------------|
| `home`  | "Brainiac 7"           | Windows | Stationary brain; Docker present           |
| `work`  | "Coding Brain"         | macOS   | Office app-building Mac                    |
| `carry` | "Mobile Control Station" | macOS | Travel Mac (the M5 Pro carry); no Docker   |

It also honors the fleet design's hosting boundary: GitHub is the source of
truth, so `TMMT-AI-RUNTIME` is its own git repo distributed by `git clone`.

## Architecture

`TMMT-AI-RUNTIME` is a standalone git repo, cloned to each machine. It has zero
runtime dependencies — Node standard library only.

### Repo layout

```text
TMMT-AI-RUNTIME/
  tmmt.js              CLI entry point — the launcher
  tmmt.command         macOS double-click wrapper → node tmmt.js
  tmmt.bat             Windows double-click wrapper → node tmmt.js
  setup.js             per-device setup: detect environment, write DEVICE_ROLE.md
  setup.command        macOS double-click wrapper → node setup.js
  setup.bat            Windows double-click wrapper → node setup.js
  lib/
    device.js          read/write the DEVICE_ROLE.md frontmatter block
    agents.js          locate, read, and filter the agent manifest
    menu.js            render the interactive numbered menu, read a selection
    run.js             spawn `npm run <script>` in AIXMOS-AGENTS with resolved env
  DEVICE_ROLE.md       generated per-machine, git-ignored
  package.json         name, bin mapping, no dependencies
  .gitignore           ignores DEVICE_ROLE.md, node_modules, .DS_Store, ._*
  README.md
  docs/superpowers/    specs and plans
```

### Components

**`setup.js`** — run once per machine after cloning. It:

1. Detects the OS (`process.platform`) and hostname (`os.hostname()`).
2. Maps the hostname to a role (`home` / `work` / `carry`). Unknown hostnames
   prompt the owner to choose a role.
3. Checks whether `docker` is resolvable on `PATH`.
4. Locates the `AIXMOS-AGENTS` checkout: probes `~/AIXMOS-AGENTS` on macOS and
   `D:\AIXMOS-AGENTS` then `%USERPROFILE%\AIXMOS-AGENTS` on Windows; prompts if
   not found.
5. Writes `DEVICE_ROLE.md`. If the file already exists, it is preserved unless
   `--force` is passed.

**`tmmt.js`** — the launcher. On every invocation it:

1. Loads `DEVICE_ROLE.md` via `lib/device.js`. If absent, prints
   "Run `node setup.js` (or `tmmt setup`) first" and exits non-zero.
2. Loads the agent manifest via `lib/agents.js` from
   `<aixmosPath>/tmmt.agents.json`.
3. Filters the agent list: when `dockerAvailable` is `false`, agents with
   `requiresDocker: true` are removed.
4. Dispatches:
   - No argument → render the numbered menu (`lib/menu.js`), read a selection,
     run the chosen agent.
   - `tmmt <id>` → look up the agent by `id` and run it.
   - `tmmt setup` → delegate to `setup.js`.
   - Unknown `id` → print the valid ids and exit non-zero.

**`tmmt.agents.json`** — a new file added to the `AIXMOS-AGENTS` repo. It is the
single source of truth for the agent list and travels with the agents, so adding
or renaming an agent never requires a launcher change.

```json
{
  "agents": [
    { "id": "jarvis",       "label": "JARVIS — ops assistant",         "script": "jarvis",       "requiresDocker": false },
    { "id": "moose",        "label": "MOOSE",                          "script": "moose",        "requiresDocker": false },
    { "id": "vision",       "label": "VISION",                         "script": "vision",       "requiresDocker": false },
    { "id": "briefing",     "label": "BRIEFING — daily briefing",      "script": "briefing",     "requiresDocker": false },
    { "id": "brain-ask",    "label": "BRAIN-ASK — query the brain",    "script": "brain-ask",    "requiresDocker": false },
    { "id": "orchestrator", "label": "ORCHESTRATOR — multi-agent run", "script": "orchestrator", "requiresDocker": false },
    { "id": "scheduler",    "label": "SCHEDULER — scheduled jobs",     "script": "scheduler",    "requiresDocker": false }
  ]
}
```

Each agent maps to an existing `npm run <script>` in `AIXMOS-AGENTS`. Final
`label` text and the exact agent set are confirmed against
`AIXMOS-AGENTS/package.json` during implementation. `requiresDocker` marks any
agent that depends on the Docker stack (e.g. a `tank` entry, if added).

### `DEVICE_ROLE.md` format

Markdown with a parseable frontmatter block — human-readable and machine-readable,
keeping the filename from the owner's original setup notes. `lib/device.js` parses
the simple `key: value` frontmatter with Node stdlib only (no YAML dependency).

```text
---
role: home
os: win32
hostname: BRAINIAC-7
aixmosPath: D:\AIXMOS-AGENTS
ollamaHost: http://localhost:11434
ollamaModel: llama3.2:3b
dockerAvailable: true
generatedAt: 2026-05-22T00:00:00Z
---
# This machine: HOME — "Brainiac 7"

Edit the frontmatter above to change how the launcher behaves on this machine.
This file is git-ignored — it is per-device and never committed.
```

### Data flow

```text
tmmt  →  read DEVICE_ROLE.md  →  read <aixmosPath>/tmmt.agents.json
      →  filter agents by dockerAvailable
      →  menu selection OR subcommand id
      →  spawn `npm run <script>`  (cwd = aixmosPath)
          env += AIXMOS_LLM_BACKEND=ollama
                 OLLAMA_HOST=<ollamaHost>
                 OLLAMA_MODEL=<ollamaModel>
      →  inherit stdio; surface exit code
```

`AIXMOS_LLM_BACKEND` is always forced to `ollama` — a hard constraint. The
launcher never selects the Claude backend.

## Per-device behavior (v1)

- `ollamaHost` and `ollamaModel` are read from `DEVICE_ROLE.md`; each machine may
  differ (for example, a Mac can point at "Brainiac 7" over Tailscale).
- Agents with `requiresDocker: true` are hidden from the menu and rejected as
  subcommands when `dockerAvailable` is `false` (the `carry` Mac has no Docker).
- Role is otherwise informational in v1; richer role-specific behavior is
  deferred to later versions.

## Error handling

| Condition                                | Behavior                                                      |
|-------------------------------------------|---------------------------------------------------------------|
| `DEVICE_ROLE.md` missing                  | Print "run setup first"; exit non-zero.                       |
| `aixmosPath` missing or not a directory   | Print the expected path; suggest re-running setup; exit.      |
| `tmmt.agents.json` missing or malformed   | Print that the manifest is absent/invalid in `AIXMOS-AGENTS`. |
| Unknown agent id (subcommand)             | Print the list of valid ids; exit non-zero.                   |
| Docker-only agent requested on no-Docker  | Print that the agent needs Docker on this device; exit.       |
| `npm run` exits non-zero                  | Menu mode: report and return to the menu. Subcommand mode: exit with that code. |

The launcher does not pre-check whether Ollama is reachable; the agents already
perform their own backend checks and report their own errors.

## Testing

`node:test` (Node standard library) — no test framework dependency.

- `lib/device.js`: parse valid frontmatter; reject malformed frontmatter;
  round-trip write then read.
- `lib/agents.js`: parse a fixture `tmmt.agents.json`; filter Docker-only agents
  when `dockerAvailable` is false; error on missing/malformed manifest.
- `lib/run.js`: build the correct command, `cwd`, and env for a given agent —
  with the process spawn mocked. Tests never launch a real agent.
- `lib/menu.js`: render a known agent list to the expected menu text; map a
  selection index back to the correct agent.

Tests use a fixture directory standing in for an `AIXMOS-AGENTS` checkout, so the
suite does not depend on the real repo being present.

## Distribution

`TMMT-AI-RUNTIME` is a git repo, intended to be pushed to
`AIXMOS537/TMMT-AI-RUNTIME` (matching the owner's other repos). Each machine gets
it via `git clone`; updates are `git pull`. After cloning, the owner runs the
setup script once. The `tmmt` command is made available either through the
double-click wrappers or, optionally, by the owner adding the repo directory to
`PATH` — no automatic shell-profile edits are performed by the runtime.

## Open questions

- Exact agent ids/scripts and human-readable labels — confirmed against
  `AIXMOS-AGENTS/package.json` during implementation.
- Whether to install a `tmmt` shim on `PATH` automatically in `setup.js`, or
  leave it as a documented manual step (current design: manual/optional).
