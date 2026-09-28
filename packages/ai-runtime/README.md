# TMMT-AI-RUNTIME

Unified launcher for the AIXMOS agents across the TMMT machine fleet
(Brainiac 7 / Coding Brain / Mobile Control Station).

## Install on a machine

1. `git clone` this repo or copy the folder.
2. Run setup once: `node setup.js`, or double-click `setup.command` / `setup.bat`.
   It detects the device and writes a git-ignored `DEVICE_ROLE.md`.

## Use

- `node tmmt.js` - interactive numbered menu of agents.
- `node tmmt.js <agent>` - run one agent directly, for example `node tmmt.js jarvis`.
- Double-click `tmmt.command` on macOS or `tmmt.bat` on Windows for the menu.

## How It Works

The launcher reads `DEVICE_ROLE.md` for this machine, reads the agent list from
`tmmt.agents.json` in the AIXMOS-AGENTS repo, hides Docker-only agents where
Docker is not installed, and runs the chosen agent with `npm run <script>` and
the Ollama backend (`AIXMOS_LLM_BACKEND=ollama`).

## Tests

`npm test` runs `node --test`.

## Design Docs

- Spec: `docs/superpowers/specs/2026-05-22-tmmt-ai-runtime-design.md`
- Plan: `docs/superpowers/plans/2026-05-22-tmmt-ai-runtime.md`
