# Brain-dump → ClickUp Agent — Design Spec

**Date:** 2026-05-21
**Status:** Draft — pending owner review
**Author:** Planning pass with Taha
**Builds on:** `docs/superpowers/specs/2026-05-17-command-center-architecture-design.md`

---

## Overview

This spec defines **v1 of the Work Command Center agent**: a conversational interface where the owner brain-dumps a stream of thoughts and the agent turns each item into a properly-structured ClickUp task assigned back to the owner's plate.

It is the first concrete piece of the broader agent-and-dispatch layer that sits on top of the May 17 multi-venture command center spec.

The agent does **not** replace ClickUp. ClickUp remains the source of truth for assignments. The agent is the bridge between the owner's unstructured thinking and ClickUp's structured task model.

---

## Goals & Non-Goals

### Goals

- Owner can paste or type a free-form brain-dump in chat and see correctly-structured ClickUp tasks appear within seconds
- Each task includes a clean title, a description that preserves the original phrasing, a venture/list assignment, and a due date when one was mentioned
- v1 lands every task on the owner's plate (owner is the human router for v1)
- Zero new server processes — runs entirely inside the existing Open WebUI instance on the home Windows PC
- The agent's behavior is defined in version-controlled files (persona prompt + ClickUp list registry), not in opaque UI clicks
- Designed so adding ventures #2, #3, … is a registry edit, not new code

### Non-Goals (explicitly out of scope for v1)

- Voice input (planned for v2 — Whisper on the home PC GPU)
- Automatic routing to executive assistants (planned for v1.5)
- Cross-venture analytics, dashboards, or status queries
- Two-way sync (ClickUp status changes flowing back into the agent's awareness)
- Replacing ClickUp's UI for managing existing tasks
- Mattermost integration (a likely v2 second front-end)

---

## Current State

- **Open WebUI** is the team's chat front-end, deployed per `~/Documents/local-ai-ops/agents/OPEN-WEBUI-IMPORT-CHECKLIST.md`. It supports custom "tools" attached to models — i.e. functions the LLM can call.
- **12 specialist agent personas** exist in `~/Documents/local-ai-ops/agents/` (arrow, batman, captain-america, …) as markdown prompts. The command-center agent persona exists in `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md`.
- **n8n** is installed in `local-ai-ops/n8n/workflows/` and could host an alternative implementation (Approach C in the brainstorm) but is not used in v1.
- **No ClickUp integration exists yet.** The owner needs to generate a personal API token via ClickUp → Settings → Apps → API Token.
- **Home Windows PC** is the "always-on brain" — Tailscale-reachable from the M5 Pro carry Mac and the M1 Max work Mac. v1 runs entirely on this box.
- **TMMT Rentals** is venture #1. Future ventures (TMMT OS) will be registered the same way.

---

## Architecture

### Runtime placement

```
[Carry M5 Pro]  ──╮
[Work M1 Max]  ───┼──Tailscale──→  [Home Windows PC: always-on]
[Office PCs ×4] ──╯                  ├── Open WebUI            (port 3000)
                                     └── Tool: clickup_create  (Python fn)
                                              │
                                              ↓ HTTPS
                                         [ClickUp API]
```

### Components

1. **Open WebUI** — already deployed. Hosts:
   - A model entry called **"TMMT Command Center"** pointing at the Claude API (`claude-opus-4-7` or `claude-sonnet-4-6` based on cost preference)
   - A persona prompt mounted from `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md`
   - A tool/function called `clickup_create_task` (see §Tool spec)
   - A second tool `list_ventures` so the agent can pick the right list

2. **Tool: `clickup_create_task`** — Python function registered with Open WebUI. Single responsibility: take structured args, create a task in ClickUp, return the task URL.

3. **Tool: `list_ventures`** — Python function that reads `~/AIX-Command-Center/config/ventures.json` (see §Configuration) and returns the list of registered ventures with their ClickUp list IDs.

4. **Persona prompt** (`tmm-business-command-center.agent.md`) — instructs the LLM how to parse a brain-dump:
   - Call `list_ventures` once at conversation start to learn the venture → list mapping
   - For each item in the brain-dump, extract `{ title, description, venture_slug, due_date?, priority? }`
   - Call `clickup_create_task` once per item
   - Reply with a numbered summary of created tasks + their ClickUp URLs

### Data flow (sequence)

```
Owner types brain-dump into Open WebUI chat
    ↓
Open WebUI sends prompt to Claude (Anthropic API)
    ↓
Claude calls list_ventures() → reads ventures.json
    ↓
Claude parses brain-dump into N task structs
    ↓
Claude calls clickup_create_task() × N
    ↓
clickup_create_task POSTs to ClickUp API
    ↓
ClickUp returns task ID + URL
    ↓
Claude returns numbered summary to owner
```

---

## Configuration

All configuration lives in version-controlled files under `~/AIX-Command-Center/config/`. No secrets in source — secrets go in `~/AIX-Command-Center/.env` (gitignored).

### `~/AIX-Command-Center/config/ventures.json`

The single source of truth for which ventures exist and where their tasks go.

```json
{
  "ventures": [
    {
      "slug": "tmmt-rentals",
      "name": "TMMT Rentals",
      "clickup_list_id": "<owner fills in>",
      "default_tag": "tmmt-rentals",
      "status": "active"
    }
  ]
}
```

Adding venture #2 = adding an entry. No code change.

### `~/AIX-Command-Center/.env` (gitignored)

```
CLICKUP_API_TOKEN=pk_<owner generates via ClickUp Settings → Apps → API Token>
CLICKUP_DEFAULT_ASSIGNEE_ID=<owner's ClickUp user ID — see §Discovery>
ANTHROPIC_API_KEY=<existing — already used elsewhere>
```

### `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md`

Already exists. Will be edited to add the brain-dump instructions and tool-calling guidance.

---

## Tool specs

### `clickup_create_task(title, description, venture_slug, due_date?, priority?)`

**Input:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | The task title — short, imperative |
| `description` | string | yes | Original phrasing from the brain-dump, preserved |
| `venture_slug` | string | yes | Must match an entry in `ventures.json` — agent gets this from `list_ventures()` |
| `due_date` | ISO date | no | Only set if the brain-dump explicitly mentioned a date |
| `priority` | int (1-4) | no | ClickUp scale: 1=urgent, 4=low |

**Behavior:**

1. Look up `clickup_list_id` for `venture_slug` from `ventures.json`. If not found → return error.
2. Look up `CLICKUP_DEFAULT_ASSIGNEE_ID` from env.
3. POST to `https://api.clickup.com/api/v2/list/{list_id}/task`:
   ```json
   {
     "name": "<title>",
     "description": "<description>",
     "assignees": [<assignee_id>],
     "tags": ["<default_tag from ventures.json>"],
     "due_date": <epoch_ms or null>,
     "priority": <1-4 or null>
   }
   ```
4. Return `{ "task_id": "...", "url": "https://app.clickup.com/t/...", "title": "..." }`.

**Errors:** if ClickUp returns non-2xx, return `{ "error": "<message>" }` so the LLM can report it to the owner verbatim.

### `list_ventures()`

**Input:** none.

**Behavior:** reads `~/AIX-Command-Center/config/ventures.json`, returns the `ventures` array filtered to `status == "active"`.

---

## Discovery (owner one-time setup)

The owner does these once. Each is a one-line action.

1. **Generate ClickUp API token** — ClickUp → Settings (top-left avatar) → Apps → API Token → Generate. Paste into `~/AIX-Command-Center/.env` as `CLICKUP_API_TOKEN`.
2. **Find owner's ClickUp user ID** — `curl -H "Authorization: $CLICKUP_API_TOKEN" https://api.clickup.com/api/v2/user`. The returned `user.id` is the assignee ID.
3. **Find the TMMT Rentals list ID** — ClickUp UI → right-click the list → Copy link → the trailing `/li/<id>` segment is the list ID. Paste into `ventures.json`.

Each step is documented as a checklist in the implementation plan.

---

## Phased Rollout

### Phase 1 — v1 brain-dump (target: 1-2 focused days)

- Owner completes discovery (token, user ID, list ID)
- Create `~/AIX-Command-Center/config/ventures.json` with TMMT Rentals entry
- Implement `clickup_create_task` Python tool in Open WebUI
- Implement `list_ventures` Python tool in Open WebUI
- Edit `tmm-business-command-center.agent.md` with brain-dump instructions + tool-calling guidance
- Register the model + tools in Open WebUI; smoke-test with a sample brain-dump
- Write a short `OPERATING_GUIDE.md` for the owner ("how to brain-dump")

**Acceptance:** Owner pastes a 3-item brain-dump into Open WebUI and sees 3 correctly-titled tasks land on their ClickUp plate in the TMMT Rentals list within 30 seconds.

### Phase 1.5 — EA routing (target: 2-3 days, after Phase 1 proven)

- Add `assistants` section to `ventures.json`: each EA gets a name + ClickUp user ID + their default scope
- Add `clickup_reassign_task` tool
- Update persona: when the owner says "route task #N to <EA name>" the agent reassigns the ClickUp task
- v1 brain-dump remains unchanged; this is purely additive

### Phase 2 — Voice input (target: 3-5 days, after v1.5)

- Install Whisper on home PC (GPU-accelerated)
- Add a voice input button to Open WebUI (or use Open WebUI's built-in voice if present in current version)
- Transcription happens locally on the home PC — no audio leaves the box
- Downstream pipeline unchanged

### Phase 3 — Multi-venture (target: rolling)

- Each new venture = one row in `ventures.json` + one ClickUp list
- The agent automatically picks up new ventures via `list_ventures()`
- No code changes

### Phase 4 — Cross-vertical reads (separate spec)

- Conversational status queries ("how's TMMT Rentals this week?") — needs a separate read-only spec, out of scope here

---

## Open Questions

1. **Which Claude model?** Opus 4.7 is best for nuanced parsing but more expensive; Sonnet 4.6 is the cost-effective default. Recommend Sonnet 4.6 for v1 with an Opus 4.7 toggle in Open WebUI for tricky brain-dumps. Owner picks.
2. **Should the tool create a single ClickUp task with subtasks, or N independent tasks?** v1: N independent tasks (simpler, easier to redo). Subtasks can be a future option.
3. **Description preservation — verbatim or rewritten?** v1 keeps the owner's original phrasing in the description so nothing is lost in translation. The LLM only generates the title.
4. **What if the brain-dump mentions a venture that doesn't exist yet?** v1: agent flags it and asks "should I create venture X?" Doesn't auto-create — the owner registers it deliberately.
5. **Cost ceiling?** A 200-word brain-dump producing 5 tasks ≈ ~3K Claude tokens. At Sonnet pricing that's pennies per dump. No need for hard caps in v1 but worth a $-per-month rough budget in Open WebUI's settings.

---

## Risks

- **ClickUp API rate limits** — 100 req/min per token. A 50-item brain-dump = 50 tool calls. Risk is low but real for power use. Mitigation: bail with a partial-success message if rate-limited and resume on retry.
- **LLM mis-parses an item** — e.g. invents a due date that wasn't said. Mitigation: agent always echoes back what it created; owner has a "fix #N" follow-up command (v1.5).
- **Token leak** — the ClickUp token is in `.env`, but Open WebUI logs prompts. The token never appears in the prompt (only in the tool function), but tool I/O may be logged. Mitigation: keep Open WebUI logs on the home PC only, never export.
- **Scope creep into "general assistant"** — easy temptation to keep adding tools (calendar, email, Slack, …). Mitigation: this spec is bounded to ClickUp task creation. Each additional tool gets its own spec.

---

## Success Criteria

1. Owner brain-dumps a 5-item stream → 5 correctly-titled tasks appear in the right ClickUp list within 30 seconds, all assigned to owner
2. Adding venture #2 takes < 5 minutes (one config-file edit + one ClickUp list creation)
3. Owner does NOT have to remember any IDs, paths, or syntax — the chat is the entire UX
4. The system survives the home PC rebooting (Open WebUI auto-restarts, config files persist, no state lost)
5. v1 is achievable by the owner alone within 1-2 focused days following the implementation plan
