# CREDIT ENGINE AUDIT — what exists, PR #224, and what blocks a real customer

Audit date: 2026-09-16 · Master `c8d72c92` · PR #224 head `9bb2b5f3` · prod `uapxakmlwnpfsftfeezx` (read-only SQL, counts only)

Owner decisions this serves: **D-22a / D-22b → A-5** — the credit pathway is ACTIVE,
part of the TMMT customer journey, and the product is a **software-led credit report
analysis and guided journey** (MFSN affiliate link → customer uploads own report →
parse → analyze → customer verifies → next steps → consultant only when warranted).
Dispute letters are downstream. **D-22c (who the consultant/provider is) is OPEN.**
§1–§7 describe the engine as built; **§8 is the gap map against the D-22b journey
and §9 the smallest sequence to one test customer.**

Labels: **F** fact · **SI** strong inference · **WI** weak inference.
Status words follow `PROJECT_AUDIT.md`. Nothing here is legal advice; every legal
item is marked for counsel.

---

## 1. Headline

- The credit desk has screens, importers, an analysis engine and a letter
  generator. **It has never held a real client** — `dispute_clients` = 0 rows,
  `credit_enrollments` = 0, `credit_funding_sessions` = 1 (F).
- **The typed dispute schema was never applied to prod.** Migration
  `20260707120000_dispute_engine.sql` (credit_profiles, credit_reports,
  tradelines, negative_items, dispute_rounds, removal_results, …) — none of these
  tables exist on prod. The live store is one JSON blob,
  `dispute_clients.payload` (F).
- **Contradiction:** `/legal/credit` says TMMT is not a credit repair
  organization, does not dispute, and refers to Khan Strategies LLC. The desk
  generates FCRA dispute letters in-house (F). D-22b (2026-09-16) made the
  product software-led analysis with letters downstream; the page still needs
  re-audit and counsel review against that model.
- **No AI model is used** anywhere in `src/lib/credit-dispute` — templates and
  rules only (F).

## 2. Feature map (master unless noted)

| Feature | Where | Data | Status | Tests | Missing |
|---|---|---|---|---|---|
| Funding-readiness intake | `/forms/credit-funding-intake`, `(admin)/credit-funding`; `src/app/forms/actions.ts` | `credit_funding_sessions` (1 row) | PARTIAL | none | collects first name only → cannot link to a person/lead/GHL |
| Report import (MyFreeScoreNow / Dispute Fox) | `/command/credit-dispute/import`; `lib/credit-dispute/importers/*` | → `dispute_clients` | UNTESTED (0 imports) | none | never exercised |
| Dispute client store | `/command/credit-dispute`; `actions.ts` (owner-only, RLS) | `dispute_clients` (0) | UNTESTED | `actions.test.ts` | no person link, no status column, all in JSON |
| Typed dispute schema | none reads it | migration on master, **not on prod** | PLANNED | — | whole schema |
| Audit / funding-readiness score | `engine/deep-audit.ts`, `protocol.ts`, `funding-readiness.ts` (runs in browser) | not persisted | UNTESTED | none | tests, persistence |
| Letter generation | `/command/credit-dispute/[id]`; `letters/generator.ts`, `advanced.ts` | inside payload | UNTESTED | none | gate, review, PDF/print |
| Delivery / mailing / tracking | text tips only | none | IDEA ONLY | — | everything |
| Responses, results, follow-up rounds | `getNextRoundType` only | none | IDEA ONLY / PARTIAL | — | response intake, reminders |
| Enrollment, billing, education, catalog | `lib/client-journey/*` reads | `credit_enrollments` 0, `credit_billing_plans` 0, `credit_product_catalog` 3, `credit_education_sections` 3 | PARTIAL (no writer) | none | enrollment writer, payment wiring |
| Program application (credit track) | GHL program webhook | `program_applications` 0 | UNTESTED | e2e fail-closed only | never used |
| GHL credit tags/stages | `ghl-tags.ts` constants | 0 contacts tagged | IDEA ONLY | — | tag writer (GHL key on BRAINIAC dead) |
| Credit contract / agreement | none | `contract_type` enum has no credit value | MISSING | — | everything |
| Legal page | `/legal/credit` | static | WORKING, contradicts desk | — | D-22b |
| CROA gate, accuracy gate, render-from-decision | **PR #224 only** | payload | see §4 | 82 tests | see §4 |

## 3. Lifecycle coverage (requirements hypothesis)

| Stage | Coverage |
|---|---|
| Lead | exists (`incoming_leads`, 885) |
| Credit-service interest | partial — `program_track` has `credit`, no lead uses it; `lane` is rental/detail only |
| Eligibility intake | partial (anonymous, self-reported) |
| Required disclosures | partial on master; CROA checklist in #224 only, **text pending counsel** |
| Agreement / contract | MISSING |
| Customer authorization | MISSING (`client_consent_given` unused) |
| Identity info | in JSON blob only |
| Credit report input | importers exist, untested |
| Analysis / issue identification | exists, untested; policy layer in #224 |
| Customer review | MISSING (no client-facing credit view) |
| Dispute workflow / document generation | partial; gated version in #224; no PDF |
| Delivery / submission | MISSING |
| Status tracking / responses / results | MISSING on prod |
| Follow-up rounds | next-round logic only, no reminders |
| Customer progress | partial reads; `journey_checkpoint_events` 0 |
| Financing-readiness next step | score + tag text; nothing pushed |
| Completion / handoff | MISSING (Slack/iMessage ping only) |

## 4. PR #224 review — **HOLD; merge after the blocking list, and split**

**What it is (F):** accuracy gate `policy/dispute-policy.ts` (dispute / coach /
hold / refuse per item — the owner rule "accurate items are coached, not
disputed"); `policy/croa-gate.ts` (disclosures, 3-business-day window,
no-fee-before-performance); `letters/render-from-decision.ts` (banned-phrase
block); `engine/gated-protocol.ts`; server action `recordItemAssessment`;
`no-browser-pii.test.ts`. Plus an unrelated vehicle-owner migration, ~26 docs, and
scripts (`askbrain.py`, Airtable export scripts).

**Verified:** 149 tests pass (4 PR test files + master's `actions.test.ts`),
`tsc --noEmit` 0 (F). No secrets in the diff (F). No credit data reaches a cloud
model; `askbrain.py` is local Ollama read-only (SI).

**Does it change…**

| Area | Finding |
|---|---|
| Contracting / disclosures | checklist only, "[OPEN] text pending counsel"; no rights statement, contract or cancel form exists (F) |
| Billing | `canCollectFee` exists; **nothing calls `croa-gate.ts`** (F) |
| Communications | none — letters saved as `draft` (F) |
| Dispute generation | gated on `/command/credit-dispute`; **`/command/credit-dispute/[id]` still calls the ungated `runDisputeProtocol`**, whose sequence includes `intent_to_litigate` (F) |
| Document storage | stays in admin-only `dispute_clients.payload` (F) |
| Audit logging | `assessedBy`/`assessedAt` overwritten in JSON; no append-only trail (F) |
| Database | credit: none. `20260901120000_vehicle_owners_and_agreements.sql` — header says NOT APPLIED; not revoking TRUNCATE from `authenticated` (F) |

**Fabrication risk — letters can state things that did not happen (F):**
1. CFPB letters fall back to invented history ("Initial FCRA dispute sent",
   "disputed … multiple times") because `priorAttempts` is never passed
   (`generator.ts:365,436`).
2. `roundsSent` counts **draft** rounds (`page.tsx:135`), so the next click writes
   "this item was reported as verified" with no bureau response; the 30-day wait
   is unused.
3. First-person claims ("identity theft report has been filed", "never held an
   account") come from a staff dropdown, not from anything the client confirmed.
4. `basis` / `basisNote` accepted from the browser without server validation;
   `basisNote` is inserted verbatim.
5. Obsolete items are auto-disputed from date fields alone
   (`dispute-policy.ts:413`); obsolescence math omits the 180-day offset and
   labels a 2-year inquiry limit "[STATED — statute]" (SI: not in §605).
6. The server does not re-run the gate — `addDisputeRoundsForClient` saves any
   letters it is sent.

**Overstated or outcome language (quote + path, for counsel):**
`generator.ts:86` "required by law to delete it … immediately"; `generator.ts:203`
"further action under FCRA §§616 and 617"; `docs/knowledge/verified-fcra-grounds.md:166`
"must be deleted"; staff UI `page.tsx:345` "Est. gain if cleared: +X–Y pts".

**Repo hygiene in the PR:** export scripts default to `./pii-archive` /
`./airtable-archive`, not gitignored; `docs/SYSTEM_OF_RECORD.md` (~L280) holds a
staff personal email; `docs/fleet-stocktake.html` (~L400) pairs plates with
vehicle-owner names (location/type only, values not reproduced).

**Blocking before merge**
1. Gate or remove Generate on `[id]/page.tsx`.
2. Re-run the gate server-side in `addDisputeRoundsForClient`.
3. Build `priorAttempts` from rounds actually marked `sent`; no invented history.
4. Count only `sent` rounds; enforce wait + real "verified" response before MOV/escalation.
5. Validate `basis` / `basisNote` on the server.
6. Fix obsolescence (180-day offset; drop or relabel the inquiry rule).
7. Remove "required by law to delete immediately" and "must be deleted" pending counsel.
8. Gitignore `pii-archive/`, `airtable-archive/`.
9. Remove the staff personal email and owner-name/plate stocktake from the repo.
10. Split the vehicle-owner migration and non-credit docs into their own PR.

**Before any live client (not merge-blocking):** wire `canBeginWork` /
`canCollectFee` into real intake and billing; counsel-supplied disclosure and
contract text; append-only assessment audit; client confirmation of each asserted
fact.

## 5. Software control vs legal requirement vs owner policy

| Kind | Items |
|---|---|
| **Software control** (built) | accuracy gate + banned phrases (main page only); CROA gate (not wired); PII out of browser; owner-only actions |
| **Legal requirement — counsel must confirm** | CROA: rights statement text, written contract terms, 3-business-day cancellation form, meaning of "fully performed", whether any fee is an advance fee · TSR advance-fee rule if sold by phone (WI: call scripts suggest phone sales) · FCRA: obsolescence math, every cited statute, the MOV theory, deletion/threat wording · whether staff may assert facts in the client's name · state credit-services law (business likely in Virginia — registration/bond **unconfirmed**; `CLAIMS_AUDIT.md` records no VDACS registration, no bond) · call-recording consent |
| **Owner / business policy** | D-22b perform vs refer · `freshAccurateItemMonths` (24), `maxRoundsBeforeReview` (4) · retention of the Airtable PII archive · whether vehicle-owner work belongs in this PR |

## 6. Customer state model — map before adding anything

Existing state carriers on prod (F):

| Concept | Where it lives today | Problem |
|---|---|---|
| New lead | `incoming_leads.agent_status` (all 885 = NEW) **and** `incoming_leads.status` free text (759 NULL) | two columns disagree |
| Rental interest | `incoming_leads.lane` and `.program` | two columns |
| Waitlist | `waitlist` table, free-text status (Waiting 24, Contacted 48, …) | no lead/person FK (SI) |
| Rental customer | `incoming_leads.status` "Active customer", `active_customers`, `client_journey.program_track=renter` | three places |
| Credit customer | `program_track=credit` (unused), `credit_enrollments` (0), a `dispute_clients` row (0) | three unconnected markers |
| Credit process active/completed | `credit_billing_plans.status` (billing, not service), `credit_enrollments.completed_at` | no service state |
| Financing preparation | `credit_funding_sessions.routing_tier`, `program_applications.status`, a GHL tag constant | duplicates |
| Credit path offered / declined, vehicle available / not, external financing outcome | — | MISSING |
| Do-not-contact | `do_not_contact_numbers` (78, phone only, no channel/purpose) vs `incoming_leads.opted_out` (0 true) vs `do_not_rent_list` (different concept) | flag and table disagree |

**Person identity (F/SI):** a lead who enters credit today gets a **second,
disconnected record**. `people` (1,210) is a GHL mirror (`incoming_lead_id` on 2
rows); `dispute_clients`, `credit_funding_sessions`, `waitlist` carry no person
key; `dispute_clients.id` is a text timestamp id; `client_journey` keys on
profile/email.

**Consent (F):** nothing records marketing consent **by purpose and channel**, so
rental consent cannot be distinguished from credit-service marketing consent.
`partner_referrals.consent_channel` records consent to a partner handoff only.

**Recommendation:** do not add the proposed statuses as new columns. First pick
one person spine and one lifecycle-state carrier (candidate: `client_journey`,
which already has `program_track` with `renter` and `credit`) — design item C-05.

## 7. What prevents a real customer moving end to end (ordered)

1. ~~D-22b perform vs refer~~ — resolved 2026-09-16 as software-led analysis;
   `/legal/credit` must be re-audited against that model (not assumed sufficient).
   D-22c (provider) open.
2. No contract, authorization or counsel-approved disclosures (legal + C-02).
3. PR #224 blockers — ungated path, invented letter history, client-side gate (C-01).
4. Dispute schema not on prod; no status, rounds or results tables (C-04, prod-gated).
5. No person spine linking lead → waitlist → credit client (C-05).
6. No purpose/channel consent; DNC split across flag and table (C-06, D-15).
7. No delivery, tracking, response intake or follow-up (C-07).
8. Zero real usage, near-zero tests on master engine/importers/letters (C-08).
9. No enrollment writer, payment wiring or GHL tag push (C-09, after D-22b and D-1/D-6).

Remediation rows: `docs/REMEDIATION_PLAN.md`, Batch 6.

---

## 8. Gap map against the D-22b journey (2026-09-16)

Master `c8d72c92` + read-only prod SQL. Statuses: WORKING · PARTIAL · BROKEN ·
UNTESTED · MISSING · DUPLICATED · UNSAFE.

| # | Component | What exists | Status | Gap |
|---|---|---|---|---|
| 1 | Affiliate entry | no MFSN outbound link or env var in `src` (F); `affiliate_links` (20) is TMMT's own operator program; unapplied `20260707130000_primary_sources.sql` adds `mfsn_member_id`/`mfsn_affiliate_ref`; `/credit`, `/funding` redirect to the GHL site | MISSING | owner's link; link-opened / returned events (nearest: `intake_events`) |
| 2 | Report upload | token-gated customer upload pattern exists for licences (`/forms/license-upload`, staff-minted expiring token, private bucket); buckets: `program-documents` 12 MB pdf/images, `staff-documents` **no size/MIME limit**; MIME check trusts browser `file.type`, no magic-byte or scan (`document-storage.ts:22-36`) | MISSING (pattern reusable) | credit-report bucket with limits, content sniffing, retention, report record tied to person + org |
| 3 | Report parsing | `importers/myfreescorenow.ts`, `shared.ts` — **staff-pasted JSON (hand-made schema) or naive CSV; no PDF/HTML/file** (F) | **UNSAFE**, 0 tests | keeps negatives only; drops positive tradelines, payment history, limits, authorized inquiries, pull date; **no provenance**; invents values: pull date = today, **bureau defaults to `experian`**, "Unknown" creditor, $0 balance → undefined; asserts `isUnverifiable` from a missing account number and `isInaccurate` + "no permissible purpose under FCRA §604" for any inquiry marked unauthorized. No real MFSN fixture |
| 4 | Normalized data | `20260707120000_dispute_engine.sql` — 9 tables, none on prod; `credit_reports.pull_date DEFAULT CURRENT_DATE`, `tradelines.dispute_eligible DEFAULT true`, no FKs to `client_journey`/org | PLANNED, misfit | inquiries, public records, personal-info variants; per-item source text/section, confidence, assertion source; link to raw file; remove eligible-by-default |
| 5 | Analysis | `engine/deep-audit.ts`, `funding-readiness.ts` (browser, not persisted); #224 `dispute-policy.ts` | **UNSAFE** (master) / PARTIAL (#224) | master marks every open item `eligible: true`, turns a parser guess into "Consumer Disputes Accuracy", a missing account number into "prior investigation failed", attaches invented `removalProbability` 60–95, and says "MUST be deleted immediately under federal law". #224 separates human accuracy calls but the human is staff, not the customer, and there is no source field |
| 6 | Customer verification loop | nothing (F) | MISSING | per-item questions; answers stored as separate evidence |
| 7 | Customer dashboard | no customer portal on master; `/learn/*` is a funding-application flow storing state in localStorage, not reachable by a `customer` role (tier "none", not public in middleware) (SI); `profiles.role` customer = 1 | MISSING | customer access (token-gated first), credit dashboard |
| 8 | Guided next steps | `credit_education_sections` 3 stub rows (61–87 chars); `credit-paths.ts` is pricing/tags only; `funding-readiness` next steps default to "continue dispute rounds" | PARTIAL / UNSAFE default | next-step rules driven by confirmed facts; real content |
| 9 | Consultant gate + case packet | `/command/handoffs` lists `partner_referrals`; no summary/packet builder (F) | MISSING | gate rules, packet, reviewer access |
| 10 | Booking | Cal.com webhook (HMAC, replay-guarded, tested) only sets `incoming_leads.agent_status='BOOKED'`; `organizations.cal_com_event_link` null on all 9; `bookings` is the vehicle rental table | PARTIAL, unconfigured | consultation booking tied to a case and provider calendar; do **not** reuse `bookings` |
| 11 | Identity linking | `client_journey` (35 rows, `org_id` on all, `program_track` includes `credit`, keys profile_id/email/ghl_contact_id); `people` is a GHL mirror | PARTIAL | `client_journey` is the best spine candidate (SI); `dispute_clients` unlinked |
| 12 | Tenant / provider | `organizations.kind` tmmt/aixmos/partner; **Khan Strategies LLC is `kind=tmmt`, `vertical=rental`** (F); an "AIXMOS Credit" partner org exists; `org_roles` 1 row; `request_handoff()` copies no client data, writes one `partner_referrals` row with text org names | PARTIAL | provider concept; org references by id; scoped data-sharing grant; Khan's org record contradicts its intended role |
| 13 | Permissions / consent | `program_applications.client_consent_given` (0), `partner_referrals.consent_*`, `credit_education_acknowledgments` (0), disclaimer booleans on `credit_funding_sessions` | MISSING | report-processing authorization, provider-sharing consent, revocation, purpose-specific communication permission |
| 14 | Document generation | letters engine (§4) | UNSAFE | stays downstream and off the customer path |
| 15 | Dispute state | `dispute_clients` JSON payload, 0 rows | UNTESTED | out of scope for the test-customer path |
| 16 | Audit trail | `audit_events` (3,892; 3,880 `lead.received`); 0 credit actions; credit actions don't write to it | MISSING | append-only upload / parse / view / answer / share / book events |
| 17 | Security | RLS on all credit tables, `documents`, `client_journey`; `dispute_clients`/`documents` platform-admin only; no payload logging; **no AI calls on credit data** (F); staff importer holds the full report in the browser | PARTIAL | report file protections, retention/deletion, provider access, isolation tests |
| 18 | Testing | 0 tests for importers, deep-audit, funding-readiness, letters, credit-paths; no report fixtures | MISSING | fixture-based parser and analysis tests; e2e on synthetic data |

**Reuse, don't rebuild:** token-gated upload pattern + private buckets; signed-URL
helper in `(admin)/document-actions.ts`; `client_journey` as spine; `audit_events`;
Cal.com webhook; `request_handoff` / `partner_referrals` (hardened); #224's
`dispute-policy` accuracy vocabulary (after C-01).

**Do not reuse as-is:** the parser, `deep-audit.ts`, `funding-readiness` next
steps, `20260707120000` table defaults, the `bookings` table, `/learn`
localStorage state.

## 9. Smallest sequence to ONE test customer — PROPOSED, awaiting owner approval

Target: **affiliate entry → report upload → analysis → customer review →
consultant booking** with a **synthetic or owner-consented sample report**, no
dispute, no charge, no real customer, no production write without the D-18 gate.

| Step | What | Depends on | Notes |
|---|---|---|---|
| **S0 — owner inputs** | (a) the MFSN affiliate link; (b) what file MFSN actually lets a customer download (PDF? printable page?) plus one sample — the owner's own report with his consent, redacted, or a hand-built synthetic; (c) test consultant + a test Cal.com event; (d) MFSN affiliate-terms check on storing/uploading reports | — | parser design is blocked on (b) |
| **S1 — schema design, not applied** | reconcile `20260707120000` into the smallest set: report upload record (person/journey, org, storage path, sha256, status, retention date), report items with provenance + confidence, `assertion_source` (report / system / customer / consultant), customer answers, one case lifecycle state; fix eligible-by-default and pull-date defaults | S0(b) | written as a staged migration + rollback; applied only on a Supabase branch or local stack (branching may cost money — owner gate) |
| **S2 — deterministic parser v2** | parse the verified format into S1 shapes; every item carries source; missing = null + flag, never a default; tests on the fixture | S0(b), S1 | no AI; replaces the pasted-JSON path for this flow |
| **S3 — analysis v2** | categorize (open/closed/collections/lates/utilization inputs/inquiries/age/possible duplicates); everything emitted as `system`-sourced flags; no eligibility, no probabilities, no legal wording | S2 | tests pin "negative ≠ disputable" |
| **S4 — customer access + upload** | token-gated link (licence-upload pattern), private credit-report bucket with size + content-sniffed PDF limit, report-processing acknowledgment, audit events | S1 | smallest path; full customer login is later |
| **S5 — customer review** | one question per flagged item; answers stored as `customer`-sourced evidence; nothing becomes a dispute | S3, S4 | |
| **S6 — case packet + booking** | read-only packet for the test consultant (summary, flags, customer answers, open questions); Cal.com event link on the provider org; webhook ties booking to the case | S5, S0(c) | provider modeled as an org, not hard-coded; isolation test: TMMT Rentals staff cannot read the case |
| **S7 — end-to-end proof** | e2e on a preview deploy with the synthetic report: link → upload → analysis → answers → booked; audit trail shows each step | S1–S6 | **STOP for owner approval** |

Out of this sequence on purpose: #224 fixes (C-01, still required before any letter
reaches a customer), billing, disputes, outreach to historical leads, cross-tenant
transfer of real data, MFSN direct integration.
