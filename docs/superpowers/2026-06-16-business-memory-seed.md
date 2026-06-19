# Business Memory Seed — 2026-06-16

**Purpose:** Hand-authored seed memory captured directly from the owner. These
are durable, owner-stated facts that the Memory Fabric (Phase 5 — Seed history)
will ingest into `memory_facts` / `memory_events`. Recorded here first so they
survive across sessions immediately, before the fabric is live.

> Format mirrors the `memory_facts` schema (entity · fact · visibility · source)
> so this file can be loaded programmatically later.

---

## 1. Airtable is permanent — a strategic asset, not legacy

| field | value |
|---|---|
| **entity** | TMMT / AIXMOS platform (org) |
| **kind** | decision / standing-truth |
| **visibility** | org |
| **confidence** | 1.0 (owner-stated) |
| **source** | owner, 2026-06-16 |

**Fact:** The owner will **not** retire Airtable. The reason is the **AI-agent
automations and triggers wired into Airtable's tables and fields** — collectively
these let data be processed and entered at **lightning-fast speed**. This is the
mechanism that lets *many different users and businesses* onboard and run their
data operations fast enough to "stay afloat."

**Implications (carry forward in all planning):**
- Airtable is a **first-class, permanent source** in the Memory Fabric — the
  fabric *ingests from* it; it never tries to replace it.
- This **supersedes** the "Airtable was replaced by Supabase" narrative in
  `docs/STATUS.md` and `CLAUDE.md`. The accurate model is: **Supabase = system
  of record for the app; Airtable = the high-speed, agent-automated intake/ops
  layer.** They coexist.
- Any future "consolidation" proposal must preserve the Airtable automation
  layer. Do not propose removing it.

---

## 2. Sales pitch / offer deck — three price tiers

| field | value |
|---|---|
| **entity** | AIXMOS offer / sales deck |
| **kind** | pricing |
| **visibility** | org |
| **confidence** | 1.0 (owner-stated) |
| **source** | owner, 2026-06-16 |

**Fact:** The sales pitch and offer deck exist in **three variations**, priced at:

| Tier | Price |
|---|---|
| Entry | **$3,750** |
| Mid | **$7,500** |
| Top | **$15,000** |

**Carry forward:** Any deck, proposal, or funnel work should map to these three
tiers. (Open question for owner: what each tier includes — scope/features per
price point — is not yet recorded.)

---

## 3. Hardware tiers → remote dispatch operator program

| field | value |
|---|---|
| **entity** | Operator hardware program |
| **kind** | product / program |
| **visibility** | org |
| **confidence** | 1.0 (owner-stated) |
| **source** | owner, 2026-06-16 |

**Fact:** The operator offering ships in **three laptop tiers**, scaling toward a
fully-developed, **enterprise-level** system:

| Tier | Spec | Intended level |
|---|---|---|
| Entry | **8 GB** laptop | starter operator |
| Mid | **16 GB** laptop | standard operator |
| Top | **32 GB** laptop | fully-developed / enterprise |

**The vision:** turn each person into a **remote-control dispatch operator** who
needs only **a laptop and an internet connection** to get online and make money.
The program is also **learn-and-teach**: an operator earns while learning, and is
only allowed to **teach others after they have learned everything to completion**.

**Carry forward:**
- The three hardware tiers likely pair with the three offer-deck price tiers
  (§2) — confirm the mapping with the owner.
- "Teach only after full completion" is a **gating rule** for the training/
  certification flow — operators unlock teaching only at 100% curriculum
  completion.

> **Confirmed 2026-06-16:** the mid laptop tier is **16 GB RAM** (not 16 TB).
> The ~25–30 TB figure refers to **home NAS storage** behind the brain (§5), not
> a laptop. Laptops (8/16/32 GB) are operator *endpoints*; the brain is separate.

---

## 4. Quo is the rebrand of OpenPhone — keep it

| field | value |
|---|---|
| **entity** | Quo (business phone / SMS platform) |
| **kind** | tooling decision / standing-truth |
| **visibility** | org |
| **confidence** | 0.95 (well-corroborated secondary sources; quo.com/pricing blocked to scraping) |
| **source** | research pass, 2026-06-16 — see `docs/QUO-EVALUATION.md` |

**Fact:** **Quo = OpenPhone, rebranded** ("Quo, formerly OpenPhone", AI assistant
"Sona"). It is a mature shared team-phone platform with SMS + calls + AI
transcripts + REST API **and MCP** — the automation the owner depends on is a
strength, not a risk. **Decision: keep Quo.** The only cheaper paths each cost
something (Twilio DIY = build your own inbox; Sakari/TextMagic = no calling;
Google Voice/Grasshopper = no automation API). Possible future optimization:
offload *bulk* automated SMS to Twilio while keeping Quo as the front end — only
if volume makes $0.01/segment a real cost.

**Operational note (not a Quo flaw):** the John Lopez texts failed with HTTP 402
— the Quo workspace is **out of prepaid credits**. Top up to restore automation.

---

## 5. The "Brain" — Brainiac PC + home NAS

| field | value |
|---|---|
| **entity** | Infrastructure (the Brain) |
| **kind** | infrastructure / standing-truth |
| **visibility** | org |
| **confidence** | 1.0 (owner-stated) |
| **source** | owner, 2026-06-16 |

**Fact:** The **"brain"** is a custom-built, always-on **gaming PC ("Brainiac")**
the owner built to house the entire AIXMOS / memory stack. Bulk storage is a
**home NAS with ~25–30 TB**, plus whatever sits on the Brainiac PC itself. The
laptop tiers (8/16/32 GB, §3) are **operator endpoints**, distinct from the
brain. The brain + NAS live on the home network and are reached over **Tailscale
(the mesh)**.

## 6. Cross-mesh access requirement

| field | value |
|---|---|
| **entity** | Memory Fabric / mesh access |
| **kind** | requirement |
| **visibility** | org |
| **confidence** | 1.0 (owner-stated) |
| **source** | owner, 2026-06-16 |

**Fact:** The mesh, the brain, the memory, and **anything relevant being noted,
saved, understood, or learned** must be **pullable from any and all computers**
that (a) connect to **Tailscale / the mesh / the brain**, or (b) run the
**AIXMOS agent**. Design lives in `docs/MEMORY-MESH-ACCESS.md`. Mechanism:
structured memory in Supabase (cloud, reachable anywhere with the token); bulk/
private data on the NAS exposed **only** over Tailscale; every node reaches the
shared brain through the Memory Fabric API (`/api/memory`, Bearer
`MEMORY_API_TOKEN`) and/or the MCP bridge registered in each node's AIXMOS agent.

## 7. Identity — HAILMARY = the owner, exclusively

| field | value |
|---|---|
| **entity** | Identity: HAILMARY |
| **kind** | identity / naming rule |
| **visibility** | org |
| **confidence** | 1.0 (owner-stated) |
| **source** | owner, 2026-06-16 |

**Fact:** As of **2026-06-16**, the name **HAILMARY refers strictly and
exclusively to the owner** (Muhammad Taha, `tmmtautodetail@gmail.com`). It is
**not** a label for the AI / engineer persona or any agent. In the Memory
Fabric, events/decisions attributed to "Hailmary" map to actor_kind `owner`.
Agents must not adopt or sign as "Hailmary."

## Open questions for the owner (recorded, not blocking)

1. What features/scope define each of the three offer tiers ($3,750 / $7,500 / $15,000)?
2. Do the hardware tiers (8/16/32 GB) map 1:1 to the price tiers?
3. Confirm "16 GB" (RAM) vs "16 TB" (storage) for the mid laptop tier.
4. What is the operator curriculum, and what counts as "completion" for the teach-unlock gate?
