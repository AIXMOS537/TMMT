# Employee Fleet — always-on nodes that work like staff, local-first

Every always-on machine on the mesh runs **looping "employees"** that serve the
business on the **local brain** — so they work 24/7 without draining cloud credits.
Cloud is overflow only. This is the map of who runs what, and the cost doctrine that
keeps usage near zero.

Owner is referenced by **role** here (see `config/identity.config.json`) — no legal
name in the repo (ghost protocol).

## Cost doctrine — never drain credits on routine work

**The ladder every chat, loop, and agent follows:**

1. **LOCAL (default, free, private):** Ollama on the mesh, via the brain-router
   (`scripts/brain-router.sh` → LiteLLM on `:4000`, tailnet-only). Model names
   `code` (`qwen2.5-coder:14b`) and `chat` (`qwen2.5:14b`). **All loop/agent volume
   runs here.** Zero credits.
2. **CHEAP CLOUD (overflow, opt-in):** ONE legitimate key, cheapest tier first
   (e.g. Haiku) via the router — used only when local is busy or insufficient.
   Off by default (commented in `tools/brain/litellm.config.yaml`).
3. **BIG CLOUD (on demand only):** Sonnet/Opus/Fable — only for a task that
   genuinely needs it, never for routine loop work. A chat "drops down" to local
   for everything else.

**Rule:** a loop/employee that can run on `chat`/`code` (local) **must**. Reaching
for a paid model is a deliberate escalation, not a default. The GitHub-side reaper
(`.github/workflows/session-autopilot.yml`) uses **no model at all** — pure git/gh —
so branch/PR housekeeping is always free.

## The always-on employees (loop hosts)

| Node | Mesh name | Always-on | "Employee" role (local-first loop) |
|---|---|---|---|
| **Office PC** (stays on forever) | `office-pc` | **Yes, 24/7** | 🏢 **Night-shift / front desk** — hosts the always-on ops loops (autopilot upkeep, watchtower health, intake triage drafts) on the local brain. The machine that never sleeps. |
| **Windows brainiac build** | `brainiac-win` | **Yes** | 🧠 **Heavy-compute employee + warm backup** — GPU/batch jobs, big local models, failover for the M1. |
| **M1 Mac — "Rick"** | `brainiac-mac` | **Yes** | 🧠 **Primary brain / owner-proxy** — HAILMARY always-on + autopilot (`scripts/office-up-rick.sh`), memory loop, vault, the conversational rail the carry Mac texts. |
| **Carry Mac (M5)** | `carry-mac` | No — **on the owner / on the move** | 📱 **Mobile command** — light local model; talks to the home brain remotely. Not a loop host (it travels); it *directs*, the always-on nodes *do the work*. |

> Add `office-pc` to `docs/FLEET-ROSTER.md` and give it a `.swarm/machine` name when
> it's provisioned (`scripts/setup-node.ps1` for Windows). Until then this doc is the
> intent; the roster is the registry.

## Who the employees serve (priority, obeyed in order)

1. **The owner** and the business's direction and **values** (identity config)
2. **Family**
3. **Team members**
4. **Students**
5. **Operators**

Every customer / money / legal / production action still terminates at the
**owner-approval gate** (CLAUDE.md §NON-NEGOTIABLE + `shared/owner-approval-gate/`).
Employees draft, prepare, and run upkeep autonomously; they never send/pay/sign/ship
on their own. Legal-gated verticals stay locked.

## Make a node an employee (local-first, one time)

1. **Provision the node:** `scripts/setup-node.sh` (mac) / `scripts/setup-node.ps1`
   (Windows) → joins the tailnet + mesh.
2. **Local brain up:** `scripts/setup-llm.sh` pulls the RAM-sized Ollama model;
   `scripts/tmmt brain router` starts the LiteLLM router (local primary).
3. **Point loops at local:** set `POCKET_BRAIN_URL=http://<brain-tailnet-ip>:4000/v1/chat/completions`
   and use model `code`/`chat`. Agents inherit this — no cloud key needed.
4. **Persist the loops:** on the M1, `scripts/office-up-rick.sh` (autopilot + always-on
   HAILMARY, login-boot). On Windows/office-pc, run the node's autopilot equivalent so
   the upkeep loop restarts forever.

Net: the always-on nodes are the staff, the local brain is free, the carry M5 is the
owner's mobile command — and cloud credits are spent only when a task truly earns it.
