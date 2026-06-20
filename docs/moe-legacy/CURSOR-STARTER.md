# Cursor Starter — Moe Legacy (Credit-Guidance + Business-Funding Agency)

> **For Moe.** Paste this whole file as your first message to Cursor in the Moe Legacy
> app repo. It tells Cursor exactly what to build, the hard legal guardrails, and how
> the app plugs into the AIXMOS network. If Moe Legacy lives in a **separate repo**,
> paste this there; if it's a tenant inside TMMT, the patterns below already exist —
> reuse them, don't reinvent.
>
> **Not legal advice.** Counsel must review the product copy + contracts before anyone
> is charged. This is the engineering map, not legal sign-off.

---

## Your role

You are my senior engineer building **Moe Legacy** — the AI **credit-guidance +
business-funding guidance** agency app. It must be **production-grade and
compliance-first**, in the same stack as TMMT (Next.js 16 App Router, TypeScript
strict, Tailwind 4, Supabase). Build in small, reviewable commits. Explain trade-offs.
**Do not deploy** without my go.

## What Moe Legacy is (and is not)

- **Is:** AI-guided **education + workflow** that helps people understand and improve
  their credit and **funding readiness**, organize documents, build budgets, and dispute
  **genuinely inaccurate/unverifiable** items *themselves*; and helps businesses prepare
  for capital.
- **Is NOT:** a guaranteed-deletion machine, advance-fee credit "repair," CPN/synthetic-
  identity service, or anything that promises scores/funding. That framing is the only
  one that scales to "sell to anyone."

## The legal guardrails (NON-NEGOTIABLE — read `docs/CREDIT-FUNDING-COMPLIANCE.md`)

The AI and the product **MUST NOT**:
- Promise/imply guaranteed deletions, score increases ("+N points"), or funding.
- Advise removing **accurate** information.
- Create/suggest **CPNs, synthetic identities, or new credit files**.
- Draft/file knowingly false or frivolous disputes.
- Give legal advice or draft binding legal documents.
- Tell anyone to stop paying lawful debts.
- Collect **advance fees** for credit-repair work not yet performed (CROA/FTC).

Laws in scope: **CROA, FTC Telemarketing Sales Rule, state CSO registration + surety
bonds, FCRA, ECOA/UDAAP, securities law (the moment you offer returns), GLBA/privacy.**
Counsel localizes per state before launch.

**The AI MAY:** educate on scoring/reports/funding readiness; help users dispute
*inaccurate* items themselves; build budgets, checklists, organize docs; explain options
and general eligibility in plain language.

## The runtime guardrail (enforce, don't aspire)

Every consumer-facing AI output must pass the compliance checker **before send**:

```bash
node scripts/compliance-check.mjs --product credit_repair path/to/output.txt
# exit 1 + "DO NOT SEND" on any prohibited claim; warns on missing disclosures
```

Wire this (or the shared `src/lib/compliance.ts` guard) into the chat/response path so a
non-compliant reply is **blocked and replaced** with a safe fallback, and the violation
is logged. Required disclosures ("results not guaranteed," "you can dispute yourself for
free," CROA cancel rights) must render in the UI and on contracts. Gate **payments**
behind the `config/credit-compliance.json → pre_sale_gate` (counsel sign-off).

## How Moe Legacy plugs into the AIXMOS network

- **Engine:** Moe Legacy is an **agency** powered by **PROJECT AIXMOS** (the owner's
  engine). It never exposes or resells HAILMARY or the private AIXMOS network — public
  brand is **AIXMOS + Moe Legacy** only (`docs/NETWORK-TOPOLOGY.md`,
  `docs/AIXMOS-CHARTER.md`).
- **Leads:** intake flows into the **shared lead pool**, attributed by utm/source, routed
  to Moe Legacy by vertical = `funding`, then **claimed/assigned** to operator sub-
  accounts. Reuse `src/lib/lead-pool.ts` (`routeLead`/`claimLead`/`assignLead`) and the
  `lead_pool` schema — atomic claim, no double-claim.
- **Sub-accounts:** students/operators get **fenced** sub-accounts (their own leads +
  clients), under the Moe Legacy agency tenant. RLS must keep siblings blind to each
  other (see the lead-pool RLS pattern in the latest migration).
- **Tokens:** AI usage is metered in **TMMT tokens**; **everyone pays** (the engine isn't
  free) — reuse `src/lib/token-ledger.ts` (atomic spend, idempotent grant, refund on
  failure). Owner is the only `unlimited`.
- **Existing artifacts to build on:** `tenants` row `moe-legacy`
  (`supabase/migrations/20260609000001_tenants.sql`), `credit_funding_sessions`, the
  partner-deploy control plane (`docs/superpowers/.../2026-06-09-moe-legacy-partner-
  deploy-*`).

## Build blueprint (suggested order — confirm with me before big pieces)

1. **Compliance spine first** — the runtime guard + disclosures + pre-sale gate. Nothing
   consumer-facing ships until this is wired and tested.
2. **Intake + lead pool** — public funding/credit-readiness form (zod-validated, rate-
   limited) → `lead_route(..., 'funding', moeAgencyOrgId)`.
3. **Operator console** — claim/assign leads, work a client (education workflow, doc
   checklist, dispute-eligibility helper for *inaccurate* items only).
4. **AI guidance chat** — self-hosted brain, token-metered, compliance-gated on every
   reply, with disclosures.
5. **Funding readiness** — checklist, document organizer, plain-language eligibility
   (no promises, no brokering without licensing review).
6. **Admin/agency** — pipeline, RLS-fenced reporting, CSV export (mirror TMMT's
   `ExportButton`/`src/lib/csv.ts`).

## Reuse, don't reinvent (shared patterns from TMMT)

| Need | Reuse |
|---|---|
| Auth + tier routing | `middleware.ts` (getUser, fail-closed) |
| Public form actions | `src/app/forms/actions.ts` (zod) |
| Read fetchers | `src/lib/queries.ts` (read-only) |
| Tokens | `src/lib/token-ledger.ts` |
| Lead pool | `src/lib/lead-pool.ts` + `lead_pool` migration |
| Compliance | `src/lib/compliance.ts` + `scripts/compliance-check.mjs` |
| UI kit | `src/components/ui.tsx` |

## The gates (must pass after each change)

```bash
npm run build && npm test && npm run lint && bash scripts/secret-scan.sh
```

## Definition of done (per feature)

- [ ] Compliance guard wired + disclosures rendered + a test proving a prohibited claim
      is blocked.
- [ ] RLS proven: operators/siblings can't see each other's clients/leads.
- [ ] Tokens metered (everyone pays); spend atomic, grant idempotent.
- [ ] Charter boundary intact (no HAILMARY / private-network exposure).
- [ ] Gates green; tests added; small commits; **no deploy without owner go.**

## Open questions to confirm with the owner before building

1. Is Moe Legacy a **separate repo/deploy**, or a **tenant inside TMMT OS**? (Changes
   where this code lives.)
2. Which **states** are in scope first? (CSO registration + bond requirements differ.)
3. Funding side: are we **brokering** capital (needs licensing review) or only doing
   **readiness/education**?
4. Has **counsel** signed off the product copy + contract (the `pre_sale_gate`)?
