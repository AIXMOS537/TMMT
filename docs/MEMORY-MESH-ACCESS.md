# Memory Mesh Access — pull the brain from any node

**Date:** 2026-06-16
**Goal (owner):** the mesh, the brain, the memory, and anything noted / saved /
understood / learned must be **pullable from any and all computers** that connect
to **Tailscale / the mesh / the brain**, or that run the **AIXMOS agent**.

This extends the Memory Fabric (`docs/superpowers/specs/2026-06-16-memory-fabric-design.md`)
with the *access plane* — how every machine reaches one shared brain.

---

## The mental model: three planes, one brain

```
        ┌──────────────────────── STRUCTURED MEMORY (system of record) ───────────────────────┐
        │  Supabase (cloud Postgres + pgvector): memory_events / memory_facts / memory_entities │
        │  Reachable from ANYWHERE with the token — no mesh needed for this part.                │
        └───────────────────────────────────────────────────────────────────────────────────────┘
                                   ▲ recall() / remember()  (Bearer MEMORY_API_TOKEN)
                                   │
   ┌───────────────────────────────┼──────────────────────────────────────────────────────────┐
   │                ACCESS PLANE  (one door: /api/memory + MCP bridge)                          │
   │   any node calls the same remember()/recall() — over the internet OR over Tailscale        │
   └───────────────────────────────┼──────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┴──────────── PRIVATE / BULK PLANE (Tailscale-only) ─────────┐
        │  Brainiac PC (always-on host) + Home NAS (~25–30 TB)                                   │
        │  big files, recordings, model weights, embeddings cache, archives, backups            │
        │  NEVER public — referenced by URI in memory_*.details / external_refs                  │
        └────────────────────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** the *structured* brain (facts/events) already lives in Supabase
cloud, so it's **already pullable from any computer** with the token — that part
is done. The mesh is for the **private + bulk** layer (NAS, the Brainiac host)
and for letting local nodes (operator laptops, the brain) all hit one endpoint
without exposing the NAS to the internet.

## Roles of each box

| Box | Role |
|---|---|
| **Supabase (cloud)** | System of record for structured memory. Always reachable. |
| **Brainiac PC** | Always-on host of the access plane (the memory API + MCP bridge) and the AIXMOS agent runtime. The "front door" on the tailnet. |
| **Home NAS (~25–30 TB)** | Bulk/private store: files, recordings, embeddings, model weights, backups. Tailscale-only. Referenced by URI, not copied into Postgres. |
| **Operator laptops (8/16/32 GB)** | Endpoints. Run the AIXMOS agent + MCP bridge; recall/remember against the same brain. |

## How any node "pulls the brain"

Every machine uses the **same two primitives** (already shipped):

1. **HTTP:** `POST /api/memory` with `Authorization: Bearer <MEMORY_API_TOKEN>`,
   ops `recall` / `remember`.
2. **MCP:** register `scripts/memory-mcp-server.mjs` in that node's AIXMOS agent
   config, pointed at `MEMORY_API_URL`. The agent then has `recall`/`remember`
   tools automatically — "recall before acting, remember after."

A node reaches the door via one of two URLs:
- **Cloud URL** (e.g. `https://<app>/api/memory`) — works off-mesh, for the
  structured brain.
- **Tailnet URL** (e.g. `http://brainiac.<tailnet>.ts.net/api/memory` via
  MagicDNS) — for private/NAS-backed access that must never be public.

## Setup recipe — the parts only you can run (on your hardware)

> These run on your machines, not from this repo's CI. One-time wiring; after
> this it's self-serving.

1. **Tailscale on every box** — install on Brainiac, the NAS, and each operator
   laptop; join the one tailnet. Enable **MagicDNS**.
2. **Host the access plane on Brainiac** — run the TMMT app (or just the
   memory service) there, then expose it on the tailnet:
   ```
   tailscale serve https / http://localhost:3000
   ```
   (gives you `https://brainiac.<tailnet>.ts.net` reachable by tailnet nodes only)
3. **One shared secret** — set the **same** `MEMORY_API_TOKEN` on Brainiac and
   in each node's MCP bridge env. This is the brain's key.
4. **Register the MCP bridge per node** — in each AIXMOS agent config:
   ```
   MEMORY_API_URL = http://brainiac.<tailnet>.ts.net/api/memory   # or the cloud URL
   MEMORY_API_TOKEN = <same token>
   node scripts/memory-mcp-server.mjs
   ```
5. **NAS on the tailnet only** — share the ~25–30 TB via SMB/NFS or a tiny file
   API, reachable over Tailscale exclusively. Store large artifacts there; put
   their tailnet URIs into `memory_entities.external_refs` /
   `memory_events.details` so recall can point to them without bloating Postgres.
6. **Tailscale ACLs** — scope which node tags may reach the memory door and the
   NAS (e.g. `tag:operator` can recall/remember but not browse raw NAS shares).

## Identity on the mesh

Every node tags its events with an actor. **HAILMARY = the owner**
(`actor_kind = owner`) — exclusively, per the 2026-06-16 decision. Operators are
`operator`, agents are `ai_agent`, outside parties are `external`. That's how the
unified timeline stays correctly attributed no matter which computer it came from.

## What's already done vs. what's yours to wire

| | Status |
|---|---|
| Structured brain reachable from anywhere (cloud + token) | ✅ live |
| `/api/memory` door + MCP bridge | ✅ shipped |
| Capture from app actors | ✅ shipped |
| Tailscale install + `serve` on Brainiac/NAS/laptops | ⏳ you (hardware) |
| Same `MEMORY_API_TOKEN` across nodes | ⏳ you (env) |
| NAS bulk store on tailnet + URIs into memory | ⏳ Phase 3+ |
| Per-node AIXMOS agent recall/remember discipline | ⏳ Phase 3 (AIXMOS repo) |
