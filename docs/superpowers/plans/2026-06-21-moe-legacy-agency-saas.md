# Moe Legacy — Agency-SaaS Rollout Plan

**Owner:** X (Muhammad Taha) · **Date:** 2026-06-21 · **Status:** plan for owner review
**Spec:** `docs/superpowers/specs/2026-06-21-moe-legacy-agency-saas-design.md`

Phased so **money leads, IP follows, and every step is reversible.** Each phase has a clear
**owner gate** and a **payment milestone** (toward the up-to-$50K, one step at a time). Nothing
partner-facing ships before the **signed contract**. Agents never deploy — owner ships via
`scripts/ship`.

Legend: 🟢 = I can build it safely now (code only, no prod writes/deploy) · 🟡 = owner click /
live write · 🔴 = legal/owner decision (hard gate).

---

## Phase 0 — Legal + protective pre-flight  (BEFORE any IP moves)
**Milestone:** contract signed + deposit. **Gate:** 🔴 owner + counsel.
- 🔴 **Sign the B2B agreement** (TMMT … LLC → Moe Legacy): IP ownership stays Taha's, non-compete
  carve-out (TMMT/AIXMOS/GHL agency/operators are Taha's), commission terms. *Draft exists.*
- 🔴 Confirm **CROA/FTC** posture with counsel for the credit side ("guidance," not "repair").
- 🟡 The owner-only protective clicks from the sweep (GitHub 2FA/branch protection, Tailscale
  device approval, Twilio 10DLC, Vercel Ignored Build Step) — close these in parallel.
- **Why first:** this is the firewall. No code reaches Umar until this is done.

## Phase 1 — Moe Legacy tenant + brand (the app exists, fenced)
**Milestone:** build fee / first payment step. **Gate:** 🟡 owner review + seal.
- 🟢 Brand/tenant config in code: Moe Legacy persona overlay, `partner_app_slug`, portal
  branding off the org row (no secrets, no prod write).
- 🟢 Generalize `provision-operator.command` → `provision-tenant` + `provision-seat` (vertical +
  role aware), as **dry-run-capable** scripts (no live write until run by owner).
- 🟡 Create the Moe Legacy **org row** + Umar's **`tenant_admin` login** (live write; owner runs
  the one-shot with the service-role key on-machine). Reversible.
- **Result:** Umar logs into a Moe-Legacy-branded portal showing *only* Moe Legacy data.

## Phase 2 — Per-operator isolation (the one real build item)
**Milestone:** seats sold ($97/mo each). **Gate:** 🔴 owner-approved RLS phase + staging.
- 🟢 Author the `organization_id` RLS migration: default-deny, idempotent, reversible, with a
  **cross-tenant isolation test** (Moe Legacy ≠ TMMT visibility) — delivered as a reviewable file.
- 🔴 **Owner approves the RLS phase**, then 🟡 apply to prod via owner seal, staged + verified.
- 🟢 Wire the **token meter** for Moe Legacy seats (already built; just enable per-org grants).
- **Result:** multiple operators coexist; nobody sees anyone else's customers.

## Phase 3 — Learn → Earn → Churn pathway (10 operators ASAP)
**Milestone:** operator seats + commissions flowing. **Gate:** 🟡 owner review.
- 🟢 Role/tier config: student (Learn) → certified operator (Earn) → graduate org (Churn).
- 🟢 Onboarding one-shot for each role (thin client, zero secrets) reusing `scripts/deploy operator`.
- 🟡 Provision the first 1–2 real seats; prove the split via `operator_profiles`, then scale to 10.

## Phase 4 — Umar's command-center node (Surface Pro 4)
**Milestone:** later payment steps, toward $50K. **Gate:** 🔴 owner (device + funds).
- 🟢 Spec the fenced agent: reads/writes **only** Moe Legacy org data, holds no owner keys, obeys
  the owner kill-switch; v0 = triage/draft/follow-up/report, **no autonomous external sends.**
- 🟡 Provision the Surface as a fenced node on the tailnet (operator tag/ACL); **Traptop stays
  with Taha.** Staged only as milestones clear.
- **Result:** Moe Legacy has a "best-ever employee" that serves the contract — still fully fenced.

## Phase 5 — Vertical template (the next 30–50)
**Gate:** 🟡 owner review.
- 🟢 Extract Moe Legacy into a documented, repeatable **vertical template** (config + scripts +
  RLS pattern) so each new vertical is a provisioning run, not a rebuild.

---

## What I can start RIGHT NOW (safe, no prod writes, no deploy)
On your greenlight, the **🟢 Phase 1** items: Moe Legacy brand/tenant config in code + the
generalized **dry-run** provisioning scripts + (if you want) the **Phase 2 RLS migration as a
reviewable file with its isolation test** — all behind the gate, nothing live until you seal it.

## Hard gates I will NOT cross without your explicit "yes, now"
- Creating live logins / org rows in prod.
- Applying the `organization_id` RLS migration.
- Provisioning Umar's devices or shipping any app access **before the signed contract**.
- Any deploy or DNS change.
