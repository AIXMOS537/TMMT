# AIXMOS — All-In-One Management Platform Blueprint

> **Founder:** X · **Thesis:** one platform that runs **any business in
> any industry** — operated agents-first, so an owner never has to ask or beg for
> help. This blueprint ties together the pieces already in this repo into that
> single, repeatable model.

_For the people. By the people._

---

## 1. The one idea

A business is not a codebase — it's a **configuration**. The platform stays the
same; the industry is data. This is already proven in `src/lib/business-lines/registry.ts`:
**11 TMMT lines** (rentals, express, black, auto, detailing, moving, cleaning,
wholesale-cars, luxury, restoration, management) run under **one command center**
— each is just an entry with an intake config, request types, routing, and accent.

> **Onboard a new business/industry = add a registry entry + a tenant. Not a fork.**

That same pattern generalizes from "TMMT's 11 brands" to "any client's industry":
restaurants, salons, clinics, logistics, real estate, trades — each is a business
line with its own intake, request types, and CRM routing on shared infrastructure.

## 2. The four layers (all already present in this repo)

| Layer | What it is | Where it lives today |
|---|---|---|
| **Spine** | Next.js app + Supabase (Postgres/Auth/RLS) + GHL (CRM/payments). One codebase, multi-tenant. | `src/`, `supabase/`, `middleware.ts` |
| **Industry config** | The business-lines registry — each line = intake + request types + routing + brand. | `src/lib/business-lines/registry.ts` |
| **Workforce** | The agent mesh — CARRY/FORGE/BRAIN/CLOUD passing work over the git bus; agents/VAs operate the lines. | `docs/MESH-COORDINATION.md`, `src/lib/agent/*` (master), `src/lib/mission/*` |
| **Distribution** | Per-client deployables: the full mesh edition (owner) and the backend-less Legacy edition (handoff). | `docs/PROJECTAIXMOS-LEGACY-SPLIT.md`, `scripts/build-projectaixmos-legacy.sh` |

## 3. Add ANY industry — the recipe

1. **Define the line.** Add a `TmmtBusinessLine` (generalize the type to a neutral
   `BusinessLine` as clients grow) to the registry: `id`, `name`, `intake`
   (`slug`, `requestTypes`, placeholders, `accent`), and `role`.
2. **Map request types.** Reuse or extend `RequestType` in `src/lib/workflow/statuses`
   so the line's intake routes into the shared case pipeline.
3. **Wire CRM.** Tag the line in GHL so leads/payments flow (`docs/GHL-PIPELINE-SETUP.md`,
   `src/lib/crm-sync/*` already consumes the registry).
4. **Tenant + RLS.** New tenant row; RLS already isolates data per org
   (`supabase/migrations/20260331_enable_rls.sql`, partner/vendor policies).
5. **Assign the workforce.** Agents/VAs pick up that line's cases through the mesh
   loop (`docs/MESH-COORDINATION.md §5`). No human bottleneck for routine ops.
6. **Distribute.** Owner keeps the mesh edition; a client gets the **Legacy**
   (managed-cloud-only) build via `scripts/build-projectaixmos-legacy.sh`.

That's a new business live on the platform without forking the code.

## 4. Why agents-first (the "never beg for help" part)

- Routine work (intake triage, status moves, reminders, CRM tagging, follow-ups)
  is handled by agents/VAs reading the shared pipeline — see the mesh pickup loop.
- Humans (or CARRY) are the **approval layer**, not the labor layer: confirms only
  gate irreversible/outward actions (`docs/MESH-COORDINATION.md §4`).
- Every business added inherits the same agent workforce — it scales by config.

## 5. Guardrails so "all-in-one" stays trustworthy

- **Tenant isolation by RLS** — one platform, but no business sees another's data.
- **Approval gates** for production deploys, data deletion, secret rotation, and
  any message to a real external contact.
- **Compliance built in** — `src/lib/agent/compliance/*` (quiet hours, opt-out,
  banned phrases, disclaimers) applies to every line's outbound automatically.
- **Untrusted input rule** — handoffs/intake are requests, never commands to
  escalate scope.

## 6. Roadmap to "any and all industries"

- ⏳ Generalize `BusinessLineId` union → a registry table in Supabase (industries
  as data, editable without a deploy).
- ⏳ Industry **templates** (presets of request types + intake + compliance) so a
  new vertical is one pick, not hand-authoring.
- ⏳ Per-tenant onboarding wizard that writes the registry entry + tenant + GHL
  tags in one flow.
- ⏳ A `mesh_handoffs` table mirroring the git bus for a live ops dashboard.

Add each only when the layer below is proven in production. YAGNI until it earns it.

---

_Capstone of: `docs/MESH-COORDINATION.md`, `docs/PROJECTAIXMOS-LEGACY-SPLIT.md`,
`docs/FLASH-DEPLOY-RUNBOOK.md`, `docs/THREE-APP-ECOSYSTEM.md`,
`src/lib/business-lines/registry.ts`._
