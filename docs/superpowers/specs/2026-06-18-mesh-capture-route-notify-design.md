# Mesh Capture → Route → Notify — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design); pending spec review
**Owner:** Muhammad Taha
**Builds on:** `docs/MESH-SWARM.md`, `scripts/swarm.sh`, `scripts/mesh/presence.sh`,
the live iMessage relay (`100.77.126.8:8787`), and the local-first agent stack
(Ollama default → Claude Haiku → Claude Opus/Sonnet).

---

## 1. North Star (the full vision)

A standing system where Muhammad Taha **captures work from any of his devices**,
and the **mesh of all currently-online machines** does that work for him — using
the **cheapest engine that can do the job first** (local → low-cost API →
high-cost API), staying **safe and testable** ("nothing cracks"), getting
**smarter over time**, and reporting back over **iMessage**. Over time this grows
into full cross-device integration where any task can spin up **any skill, file,
document, or tool** available across the network, always staying current and in
unison with the owner.

That North Star is large. This spec scopes only the **first slice** that makes the
core loop real end-to-end. Everything else is captured in §10 (Future Phases) so
it is recorded but explicitly out of scope for the first implementation plan.

---

## 2. Phase 1 Scope

**In scope:** the minimal loop that delivers *"I speak/paste a braindump on my
carry Mac → the mesh does the work on the cheapest capable engine → I get an
iMessage back,"* with test-gates and the deploy seal intact.

| In scope (Phase 1) | Out of scope (later phases) |
|---|---|
| `catch` capture inbox (voice via superwhisper, paste, stdin) | Auto-capture from email/Slack/Telegram/calendar |
| Local Ollama braindump → task split | ML-based "learning"; logged ledger + heuristic only |
| `router` always-on daemon (claim → cost-ladder → test-gate → branch) | Cross-device skill/file federation |
| Cost ladder: local → Haiku → Opus/Sonnet, escalate on failure | Operator onboarding automation, ACL provisioning |
| iMessage notify on done/fail + morning digest | Per-day token budget caps (noted in §11) |
| Stale-task reclaim (lease) so any machine can drop/resume | Web dashboard / mobile app |

**Success criteria (Phase 1):**
1. A spoken/pasted braindump on the carry Mac becomes ≥1 well-formed board task
   with **zero API cost** (local parse).
2. An online M1 (or any machine running `router`) auto-claims and completes a task
   **without further input**, choosing the cheapest tier that passes the gate.
3. A code task that fails `build/test/lint` is **never** marked done — it escalates,
   and if it still fails, it surfaces as FAILED over iMessage (work never lost).
4. The owner receives an iMessage on completion; deploys still require the seal.
5. Killing the network mid-task does not lose the task (lease reclaim).

---

## 3. Architecture

```
 ┌─────────────── carry Mac (M5 Pro) ───────────────┐
 │  superwhisper (local voice→text)  ┐               │
 │  paste / stdin / `catch "..."`    ├─► catch ──► local Ollama split ─┐
 │  flagged iMessage  (Phase 2)      ┘                                 │
 └────────────────────────────────────────────────────────────────────┼──┐
                                                                        │  │
                            shared task board (swarm-coord branch)  ◄───┘  │
                            id | status | machine | branch | lane |        │
                            tier | lease | task | log                      │
                                   ▲           │                           │
            ┌──────────────────────┘           ▼                           │
            │  router daemon (M1 "Rick" = home base, + BRAINIAC, + any online machine)
            │   loop: presence beat → claim 1 TODO (atomic) → cost ladder:
            │         local Ollama → Haiku → Opus/Sonnet  (escalate on gate fail)
            │   code task → git worktree → build+test+lint gate → push branch
            │   general task → scratch dir → produce artifact
            │         on done/fail → notify + ledger
            └───────────────────────────────────────────┐
                                                         ▼
                              iMessage relay (100.77.126.8:8787) ──► owner's phone
                              ledger (~/.tmmt/ledger.tsv) ──► smarter routing
                              deploy stays sealed: `scripts/ship` (owner seal only)
```

Three new units, each independently testable, communicating only through the
**board** (transport) and small files (`~/.tmmt/inbox`, `~/.tmmt/ledger.tsv`):

- **`catch`** — capture + local parse + enqueue. Depends on: Ollama (optional),
  board writer. No network required to capture (queues locally, flushes later).
- **`router`** — claim + model-route + execute + gate + notify. Depends on: board,
  Claude CLI, Ollama, worktree mechanism, notify. Runs on every worker machine.
- **`notify`** — one function, posts to the iMessage relay. Depends on: relay URL.

---

## 4. Component: `catch` (capture)

**Purpose:** turn any raw input into clean, lane-tagged board tasks, locally and
for free.

**Interface:**
- `catch "text"` — enqueue from an argument
- `catch` (no args) — read stdin (paste) or `pbpaste` clipboard
- Watches `~/.tmmt/inbox/*.txt` — superwhisper (or a macOS Shortcut) writes a
  transcript file here; a folder watch flushes it through `catch`

**superwhisper wiring:** superwhisper transcribes on-device (free). Configure it to
either (a) write the transcript to `~/.tmmt/inbox/<timestamp>.txt`, or (b) trigger a
macOS Shortcut that pipes the text to `scripts/catch`. Either path lands in the same
inbox. (Owner picks the mode during setup; both supported.)

**Parsing (local, free):** feed the raw text to Ollama (`llama3.2:3b` default) with a
strict prompt that returns JSON:
```json
[{ "title": "...", "lane": "code|general", "hint": "easy|med|hard", "repo": "TMMT|null" }]
```
**Fallback (never lose input):** if Ollama is down or returns junk, enqueue the whole
raw text as a single `general/med` task. Capture must never fail silently.

**Enqueue:** append each parsed task to `board.tsv` via the existing atomic board
writer (§7), filling the new `lane`, `tier` (initial = derived from `hint`), and
`task` columns. Offline → tasks stay in `~/.tmmt/inbox` and flush on next online beat.

---

## 5. Component: `router` (the worker daemon)

**Purpose:** on every online machine, continuously pull work and complete it on the
cheapest capable engine, safely.

**Interface:** `router up` (daemon loop) · `router once` (single pass) ·
`router status` · `router stop` · `router digest` (morning summary).
Installed as an always-on service: LaunchAgent `com.tmmt.router` (mac),
Task Scheduler/NSSM (Windows/BRAINIAC), systemd (Linux).

**Loop (each tick):**
1. **Kill-switch check** — if `dark` is engaged (`scripts/godark` state), park and skip.
2. **Presence beat** — announce online + role (reuses `scripts/mesh/presence.sh`).
3. **Capacity check** — run at most `min(cores-2, ROUTER_MAX)` tasks at once.
4. **Claim** — atomically claim 1 `TODO` task (reuses `swarm.sh` claim), set a
   **lease** (`lease = now + ROUTER_LEASE`, default 30 min).
5. **Dispatch up the cost ladder** (§6).
6. **Gate** — code tasks must pass `npm run build && npm test && npm run lint`
   before `DONE`. General tasks must produce a non-empty artifact.
7. **Settle** — push branch (code) or save artifact (general), mark `DONE` or
   `FAILED`, append to ledger, `notify`.
8. Sleep `ROUTER_INTERVAL` (default 20s).

**Worktrees vs scratch:** code tasks run in a git worktree (existing swarm
mechanism) on `swarm/<machine>/<id>`; general tasks run in `~/.tmmt/scratch/<id>`
(no git) so non-code work never pollutes the repo. **Deploy is never run by the
router** — only branches are produced; going live stays behind `scripts/ship`.

---

## 6. The cost ladder (model router)

A pure decision function plus an executor. Decision: **the `hint` sets the starting
tier; failure escalates one tier and retries (bounded).**

| Tier | Engine | Starts here when | Good for |
|---|---|---|---|
| 0 | local Ollama | `hint=easy` | classify, summarize, draft, trivial edits |
| 1 | Claude Haiku 4.5 | `hint=med` | moderate code/writing, most day-to-day |
| 2 | Claude Opus 4.8 / Sonnet | `hint=hard` or after Tier-1 gate fail | hard reasoning, gnarly code |

- **Cheap-first within reason:** never start above the hint, but never waste a
  doomed Tier-0 attempt on an obviously hard task (the hint guards that).
- **Escalate on failure:** if the tier's output fails the gate (§5.6), escalate one
  tier and retry. Max 1 escalation past the starting tier, then `FAILED` + notify.
- **Learns:** before choosing the start tier, consult the ledger (§8) — if tasks of
  this `lane`+`hint` have historically needed a higher tier, start there. Pure
  heuristic in Phase 1 (e.g. "if ≥60% of `code/med` needed Tier 2, start at Tier 2").
- **Execution:** Tier 0 = Ollama call; Tiers 1–2 = `claude --model <id>` in the
  worktree/scratch dir reading the task prompt. Model IDs: `claude-haiku-4-5`,
  `claude-opus-4-8`, `claude-sonnet-4-6`.

This function is unit-testable in isolation (inputs: `hint`, ledger, last-result;
output: tier) with no model calls.

---

## 7. Board schema change

Extend `board.tsv` (on `swarm-coord`) from `id|status|machine|branch|task` to:

```
id | status | machine | branch | lane | tier | lease | task | log
```

- `lane` = `code|general`; `tier` = `0|1|2` (current attempt); `lease` = ISO
  timestamp a claim expires; `log` = short breadcrumb (tiers tried, cost).
- **Backward compatible:** the board is currently empty (header only), so the
  migration is a clean header replace. The `swarm.sh` `add`/`claim`/`done` mutators
  are extended to read/write the new columns; a missing column defaults safely.
- **Stale reclaim:** a reaper step (in `router` loop or `swarm.sh reap`) moves any
  `CLAIMED/DOING` task whose `lease` has expired back to `TODO`, so a machine going
  offline mid-task never strands the work.

---

## 8. Learning ledger

`~/.tmmt/ledger.tsv` (owner-local, gitignored), appended per finished task:
```
ts | task_id | lane | hint | tier_started | tier_succeeded | result | approx_cost | machine
```
Used by §6 to bias the starting tier. Phase 1 is **log + simple heuristic** only —
no model training. (A future phase may sync this to Supabase for cross-machine
learning; §10.)

---

## 9. Safety & guardrails (all reuse existing mechanisms)

- **Test gate** before `DONE` (code) — the "nothing cracks" guarantee.
- **Deploy seal** — router produces branches only; `scripts/ship` + `auth/OWNER.seal`
  remain the sole path to live.
- **Kill-switch** — `dark` parks every router; `light` (owner seal) resumes.
- **Secret guard** — existing pre-commit/pre-push hooks block secret leaks in
  agent commits.
- **Dry-run / trust-building** — `router once --explain` prints the claim + chosen
  tier + planned actions **without executing**, so the owner can watch it think
  before trusting it loose. `ROUTER_DRYRUN=1` runs the agent but skips push/DONE.
- **Operator covenant (design only, Phase 3):** team members may run `router` as
  operators only under a signed code-of-conduct, least-privilege Tailscale ACLs, and
  the owner kill-switch — never with deploy or owner-seal access.

---

## 10. Error handling

| Failure | Behavior |
|---|---|
| Ollama down (capture) | enqueue whole text as one `general/med` task — never lose input |
| Ollama down (router) | skip Tier 0, start at Tier 1 |
| Claude CLI/API error | retry w/ backoff (existing 4-try convention) → escalate → if all fail, `FAILED` + notify |
| Board write race | existing atomic fetch→edit→push retry |
| Machine offline mid-task | lease expires → reaper requeues to `TODO` |
| Carry offline at capture | queue in `~/.tmmt/inbox`, flush on next online beat |
| Notify relay unreachable | log locally + retry on next tick; never block task completion |

---

## 11. Testing strategy

- **Unit — capture parser:** fixtures of braindumps → assert task count/lanes/hints
  (Ollama call stubbed). Junk/empty input → single safe fallback task.
- **Unit — cost-ladder selector:** pure function; assert start tier from `hint` +
  ledger, and escalation on gate fail. No model calls.
- **Unit — reaper:** expired lease → task returns to `TODO`.
- **Integration (CI-safe):** enqueue a deterministic test task ("write file X with
  content Y") with a **fake echo agent** + `ROUTER_DRYRUN`; assert claim → gate →
  notify-stub path end to end, no real API spend.
- **Safety:** a task that fails `build` is asserted to escalate and end `FAILED`,
  never `DONE`.
- **Existing gate:** `npm run build && npm test && npm run lint` stays the bar.

---

## 12. Future Phases (recorded, out of scope for Phase 1)

- **Phase 2 — broaden capture & "always up to date":** auto-pickup from email,
  Slack, Telegram, calendar; watchers that keep context current; richer iMessage
  two-way control.
- **Phase 3 — operators & real learning:** operator onboarding + covenant + ACL
  automation; ledger → learned model-choice; per-day **token/cost budget caps**.
- **Phase 4 — full cross-device federation:** any task can spin up **any skill,
  file, or document** on any machine (shared/synced skills dir + MCP); the owner's
  iPhone and Windows home PC fully in the loop; "unison" = one switch boots the
  whole stack on every personal device.

---

## 13. Open questions

1. superwhisper output mode — file-drop vs Shortcut trigger (decide at setup; both
   supported, so not a blocker).
2. General-task artifact location — `~/.tmmt/scratch/<id>/` confirmed; do general
   results also get committed anywhere, or only delivered via iMessage/digest?
   (Phase-1 default: delivered + kept in scratch, not committed.)
3. Which machines run `router` at launch — M1 "Rick" is the home base; confirm
   BRAINIAC + any others to enroll, and their roster names.
