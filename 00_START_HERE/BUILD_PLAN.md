# BUILD PLAN — Sequenced

Work phases in order. Within a phase, tasks can parallelize. Each workstream folder
has its own `TASKS.md` with the granular checklist; this is the master sequence.

---

## PHASE 0 — Shared foundation (build FIRST; everything depends on it)
- [ ] `shared/compliance-gates/` — gate.ts/gate.py + gates.config.json; unit tests prove a closed gate throws and blocks the path.
- [ ] `shared/owner-approval-gate/` — approval module; Supabase `gated_actions` table; pending→approve/reject flow; owner notification. No auto-approve path.
- [ ] `shared/schemas/` — shared types: Operator, Client, FundingDeal, DisputeItem, Commission, GatedAction, Vehicle.
- [ ] `shared/config/` — env loading from `.env.template`; model-router default = Ollama, cloud = BYO-key through gateway.
- **Exit:** gates + approval gate enforced and tested; importable by WS2/WS3.

## PHASE 1 — AIXMOS Core (WS1): make it installable + show the "wow"
- [ ] `provisioning/` — one-command setup of NAS + Tailscale + n8n + Supabase + Qdrant + Ollama + Redis; guided flow; "done-for-you provisioning" path for non-technical operators.
- [ ] `fleet-economics-dashboard/` — the visible wow: utilization, revenue per vehicle, days-on-rent, maintenance cost, ROI per car, Turo-vs-direct margin. React; reads Airtable base `appcenWUju039rD7b`.
- [ ] `connectors/` — Turo import, Stripe, QuickBooks, Twilio/SMS. (Gmail/Drive/Airtable already exist.)
- **Exit:** an operator can be provisioned and see their real fleet economics; core connectors flow.

## PHASE 2 — Operator Network (WS3): the $97/mo machine
- [ ] `signup-97/` — Stripe subscription for the $97 network tier; separate one-time platform license SKU; **enforce no-advance-fee billing** on any credit-repair charge (gate: `no_advance_fee_billing_enforced`).
- [ ] `operator-portal/` — referral links, training library, compliance-approved marketing templates, commission tracking, tier status (1/2/3).
- [ ] `commission-engine/` — pays ONLY on real client services; tier benchmarks from brief; every payout routes through owner-approval gate (`pay_commission`). No recruitment-based pay.
- [ ] `covenant/` — conduct covenant acceptance at signup; conduct-based (not identity-based) violation flags via AIXMOS; documented enforcement ladder.
- **Exit:** operators can join, refer, and get paid on real services; covenant enforced; commissions gated.

## PHASE 3 — Credit + Funding Vertical (WS2): build full, ship dark
> Build the whole pipeline, but legal gates stay `false` until human sign-off. CPN/tradeline block stays `true`.
- [ ] `intake/` — GoHighLevel funnel → classify rung → generate CROA contract + disclosure + 3-day cancellation (gated: `croa_contracts_attorney_approved`, `vdacs_registered_bonded`). Run `assertNoCpnOrRentedTradelines()` on every record.
- [ ] `dispute-engine/` — local LLM drafts FCRA dispute letters from identified inaccuracies; **every letter routes through owner-approval gate** (`dispute_letter`); never auto-send; track 30-day reinvestigation clock.
- [ ] `tradeline-tracker/` — net-30 vendors, bureau reporting status, PAYDEX progression, payment reminders; Airtable-backed. (Legitimate relationship-based AU strategy only — no rented tradelines.)
- [ ] `funding-desk/` — package + match to products. Cards/LOC/SBA/equipment launch WITHOUT extra license. MCA/RBF blocked behind `sbf_broker_registered` + disclosure-form workflow. Every funding submission gated (`submit_funding_app`).
- [ ] `compliance/` — CDFI + Virginia SSBCI partnership referral integration for Rung 4 (NOT a pooled fund — `securities_counsel_cleared_fund` stays false by design).
- **Exit:** pipeline complete and tested; all legal gates `false`; flipping a gate (post-sign-off) cleanly enables that path; CPN/tradeline rejection tested.

## PHASE 4 — Launch readiness
- [ ] End-to-end test: provision → operator joins → refers a client → (credit/funding path simulated with gates closed) → fleet economics visible.
- [ ] Confirm Virginia-only; `multistate_matrix_cleared` = false.
- [ ] Security pass: no secrets committed; all PII paths land on NAS tier; approval gate on critical path everywhere.
- [ ] Compliance pass: run `shared/compliance-gates/check.*`; no gated path reachable while its gate is false.
- [ ] Hand the gate-flip checklist to Muhammad Taha (sole owner) (which legal step unlocks which gate).

---

### Standing rules while building
- Owner-approval gate on every customer message + financial action — no exceptions, no test bypasses.
- Default models to Ollama; cloud = BYO-key; never bill uncapped tokens.
- When blocked on a human decision/credential/legal step, write it under "BLOCKED — needs human" in that workstream's TASKS.md. Do not guess.
