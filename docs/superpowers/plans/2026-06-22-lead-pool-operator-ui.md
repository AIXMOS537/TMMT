# Plan — Phase 3: Operator Claim / Assign UI (lead pool)

> Builds the human surface on top of Phase 1 (pool + atomic RPCs) and Phase 2
> (capture → pool). Operators **claim** available leads; agencies/staff **assign** or
> **cross-refer**. Additive, RLS-fenced, owner-shipped migration. Nothing deploys.

## Goal

Give every operator a **Leads** screen: see *available* leads for their agency, **claim**
one atomically (first-come, no double-claim), then work it. Give agency/staff an
**assign** + **cross-refer** control. PII is protected — contact details are **masked
until claimed**.

## What exists (reused, not rebuilt)

- RPCs (service-role): `lead_claim` (atomic), `lead_assign`, `lead_cross_refer`,
  `lead_route` + TS wrappers in `src/lib/lead-pool.ts`.
- RLS: operator sees *available* agency leads + *own* claims; never a sibling's.
- UI kit: `DataTable, Modal, FormField, Button, StatusBadge, StatusPill, FilterBar,
  ErrorBanner, PageHeader` (`src/components/ui.tsx`).
- Patterns: `"use server"` action → `getUser` → role check → service-role call
  (`src/app/(admin)/admin-actions.ts`); operator routes under `(operator)/operator/`.
- Roles: `isOperatorUser`, `isStaffUser`, `getTierForUser` (`src/lib/auth-roles.ts`).

## Deliverables

### 1. Migration `supabase/migrations/20260619040000_lead_pool_view.sql` (additive)
- `mask_phone(text)` helper → `(***) ***-1234`.
- SECURITY DEFINER `lead_pool_feed(p_scope text)` returning the pool rows the **caller**
  may see, joined to safe `incoming_leads` display fields. `p_scope`:
  - `available` → status=available for the caller's agency (own org or parent), **phone +
    email masked** (protects the lead's PII and stops contact-poaching before a claim).
  - `mine` → rows the caller's org has claimed/assigned, **full contact**.
  - Visibility reuses the `lp_caller_org()` logic, so it can't leak across agencies or to
    siblings. Granted to `authenticated` (reads only what the caller may see).
- Why a function, not a client join: avoids depending on `incoming_leads` RLS for
  sub-accounts and keeps masking authoritative server-side.

### 2. Server actions `src/app/(operator)/operator/leads/actions.ts` (`"use server"`)
- `claimLeadAction(poolId)`: `getUser` → resolve caller org → **authorize** (caller org =
  pool.agency_org_id **or** caller's parent = pool.agency_org_id, via a service-role read)
  → `claimLead(service, {poolId, orgId, userId})` → `revalidatePath`. Returns
  `{success}|{error}`. Handles the `{claimed:false, reason:'unavailable'}` race → friendly
  "Someone just claimed this."
- `assignLeadAction(poolId, targetOrgId)`: authorize caller is **agency-or-staff** for that
  pool → `assignLead`. (Operators can't assign.)
- `crossReferLeadAction(poolId, targetAgencyOrgId, targetVertical)`: authorize
  **staff/agency** → `crossReferLead`.
- All errors mapped to safe messages; no internals leaked.

### 3. Read fetchers `src/lib/queries.ts` (read-only)
- `getAvailableLeads()` → `rpc('lead_pool_feed', {p_scope:'available'})`.
- `getMyLeads()` → `rpc('lead_pool_feed', {p_scope:'mine'})`.
- Both via the SSR/anon client (RLS + the function enforce scope).

### 4. UI `src/app/(operator)/operator/leads/page.tsx` (`"use client"`)
- `PageHeader` "Leads" + `FilterBar` tabs: **Available** | **My leads** (+ search,
  vertical filter).
- `DataTable` columns: vertical (`StatusBadge`), source/campaign, age, status; contact
  column shows **masked** on Available, full on My leads.
- Row action **Claim** (Available) → `claimLeadAction` → `setSaving` → refresh; disabled
  while in flight; `ErrorBanner` on failure (incl. the race message).
- Row click (My leads) → `Modal` with full contact + next-step checklist; staff/agency
  also see **Assign to operator** (select) + **Refer to other agency** (vertical select).
- Empty/loading/error states match the Admin Page Pattern.

### 5. Nav + access
- Add **Leads** to the operator `PortalChrome` nav.
- Middleware already allows operator tier on `/operator/*` — no change. Confirm
  `/operator/leads` resolves for operator + staff tiers.

### 6. Tests
- `actions` authorization: operator can claim own-agency only; cannot assign; race →
  friendly error (mocked service client).
- `mask_phone` masking shape (pure helper mirrored in TS for the table if needed) +
  feed-scope wrapper param mapping.
- Keep the suite green; build is the gate.

## Safety / guardrails (consistent with the pre-ship audit)
- Service-role writes only from authorized server actions; **claim stays atomic**.
- **PII masked pre-claim**; full contact only after a claim/assignment.
- RLS + the feed function both enforce agency/sibling isolation — **defense in depth**.
- Migration additive + **owner-shipped**; nothing auto-deploys (deploy guard in place).

## Out of scope (later phases)
- Phase 4: sub-account provisioning + token funding (operator onboarding).
- Round-robin auto-distribution, SLA timers, lead expiry sweeper.

## Owner steps after merge
1. Apply `20260619030000` (pool) + `20260619040000` (feed) migrations on your go.
2. (Optional) seed `lead_routes`; otherwise leads pool under the capturing tenant.

## Estimate
~1 migration, ~1 actions file, ~2 query fns, ~1 page, nav tweak, ~6–8 tests. One focused
PR, all gates green, same "build → test → lint → secret-scan" gauntlet.
