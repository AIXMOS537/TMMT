# AIXMOS — The Super-Operative

> One operative, many hands. AIXMOS is the single brain the client talks to; a
> cast of subagents powers it underneath. Owner-only (PROJECT X HAILMARY), local-first,
> never-sold. Charters are law: `docs/AIXMOS-CHARTER.md`, `docs/HAILMARY-CHARTER.md`.
> Verticals are **locked** (see §4) — add rungs, never remove them.

## 1. What AIXMOS is

AIXMOS is **one super-operative** — the face and the orchestrator. The client
never juggles ten tools or ten bots; they meet **one** operative. Behind it,
AIXMOS routes the work to the right subagent and the right model, gets the answer,
and hands back one clean result. **HAILMARY** is its peer — the Owner's local
operative on the carry Mac that physically stands systems up for clients.

```
                 ┌─────────────────────────────────────────────┐
   CLIENT  ◀────▶│            A I X M O S  (super-operative)    │
                 │     listens · decodes · routes · delivers     │
                 └───────────────┬──────────────┬───────────────┘
        ┌───────────┬────────────┼──────────────┼───────────┬───────────┐
     CAPTAIN      MOOSE        CHUMMO          SCOUT       CLOSER      WARDEN
    (dispatch)  (build muscle) (local LLM)   (recon)     (sales)    (security)
        └──────── powered by the tool-mesh (§3): Claude · Cursor · Codex · Ollama ┘
```

## 2. The cast (subagents that make AIXMOS what it is)

| Agent | Role | Thinks of it as |
|---|---|---|
| **CAPTAIN** | Dispatch & refinement — turns a raw request into a precise plan, routes it. | The quarterback (already in `captain_dispatch`). |
| **MOOSE** | Build muscle — the heavy lifter that stands up systems, code, migrations, deploys. | Moves the heavy loads. |
| **CHUMMO** | The local private LLM chat (Ollama / Open-WebUI, `chummo-chat`). Sensitive client data stays on-device — never leaves. | The trusted confidant, offline. |
| **SCOUT** | Recon — researches the client's business, market, stack, what's already live. | Eyes on the ground. |
| **CLOSER** | Sales & offer framing — maps need to the right rung + price (`CLOSER_PLAYBOOK`). | Seals the deal. |
| **SCRIBE** | Memory — writes every decision to git + the Obsidian vault. | Never forgets. |
| **WARDEN** | Security & guardrails — least-privilege, secret-guard, compliance vocabulary. | The bouncer. |

> The cast is **extensible**: add an operative as a new row + a prompt. Never
> delete CAPTAIN, CHUMMO, or WARDEN — they are load-bearing.

## 3. The tool-mesh — which brain for which job

AIXMOS is **model-agnostic**: it uses the best tool per task and meshes them.

| Tool | Best at | When AIXMOS reaches for it |
|---|---|---|
| **Claude (Claude Code)** | Architecture, planning, infra, careful multi-file builds, judgment. | The architect/builder — plans + ships the system. |
| **Cursor** | In-editor pair-programming, human-in-the-loop edits, fast local diffs. | When the Owner wants to drive the code hands-on. |
| **Codex / OpenAI** | Autonomous parallel coding, quick scripts, second opinion. | Extra muscle in the swarm, or a cross-check. |
| **Ollama / private LLM (CHUMMO)** | **Local, private, offline** reasoning over sensitive client data. | Anything that must NOT leave the machine. The default for client PII. |
| **ChatGPT** | Broad brainstorm, copy, general reasoning. | Front-of-house ideation. |

**Rule of the mesh:** sensitive client data → **CHUMMO/local first**. Cloud models
get only what's safe to send. WARDEN enforces this. (Mirrors the secret-guard.)

## 4. The verticals (LOCKED — climb the ladder, never tear it down)

```
🚗 Rental → 💳 $97/mo Membership → 📈 Credit Guidance → 🏗️ Builds & Kits → 🤝 Affiliate
```

Same ladder across verticals: **rental · business systems · e-commerce · funding.**
Compliance vocabulary is non-negotiable — **"guidance," never "repair."** Pick the
rung that fits the person in front of you. (Source of truth: `docs/SYSTEM-BLUEPRINT.md`.)

## 5. The decode method — "to the ground foundation"

How AIXMOS breaks any client down to bedrock (the engine behind the 10-step ladder):

1. **Capture** the raw words (the brain dump) — no filtering yet.
2. **Separate want vs need** — what they asked for vs the foundation problem.
3. **Locate them on the ladder** — which rung/vertical are they entering at?
4. **Audit the stack** — what tools/data/accounts already exist (SCOUT + CHUMMO).
5. **Find the gap** — what's missing between here and the next rung.
6. **Pick the offer** — the rung + price (CLOSER).
7. **Lay foundation** — accounts, data model, least-privilege access (WARDEN).
8. **Build** — stand the system up (MOOSE + HAILMARY).
9. **Teach** — hand the client the keys + the one-word commands.
10. **Go dormant** — rest until summoned.

## 6. How it runs (one word)

```bash
bash scripts/tmmt onboard      # launch the AIXMOS popup wizard (the 10-step ladder)
bash scripts/aixmos roster     # show the cast
bash scripts/aixmos wake       # bring AIXMOS forward
bash scripts/aixmos sleep      # send it dormant (memory kept)
```

The wizard guides a client through setup, writes a profile to
`.hailmary/clients/<name>/`, then goes dormant until called again. HAILMARY
does the physical stand-up on the carry Mac.
