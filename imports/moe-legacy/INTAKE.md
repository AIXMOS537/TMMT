# Moe Legacy — Intake Drop Zone

Mission: give **Muhammed Umar / Moe Legacy** the first best-ever system for his
business — stable, sellable, ad-ready — after his team left him out to dry. Build it
into the network for Moe Legacy → AIXMOS → X. Steady, one verified step at a time.

## How to hand off files from Umar's computer
Drop **anything relevant** into this folder (`imports/moe-legacy/`):
- documents, instructions, exports, screenshots, CSVs, contracts, GHL exports,
  spreadsheets, notes, voice-memo transcripts — whatever you have.
- Subfolder by kind if easy: `docs/`, `data/`, `instructions/`, `media/`.
- For anything sensitive (keys, passwords, account creds): **do NOT put them here**
  (this is a git repo). Hand those over separately and tell me they exist; I'll wire
  them via `.env.local` / Vercel, never committed.

Transport options (pick whatever's easiest from Umar's machine):
- AirDrop / copy into this folder directly
- Google Drive / iCloud → download into this folder
- Paste text straight into chat
- Tailscale (Umar's box → this Mac) once it's shared

## What I already have (don't re-send these)
- Deploy + handoff: `docs/LEGACY-DEPLOY-MOE.md`, `scripts/partner-deploy/moe-handoff/`,
  `docs/superpowers/plans/2026-06-09-moe-legacy-partner-deploy-plan.md`
- Compliance (CROA-safe language): `COMPLIANCE_DISCLAIMERS.md`,
  `docs/CREDIT-FUNDING-COMPLIANCE.md`
- Operator runbooks: `docs/runbooks/MASTER_OPERATOR_RUNBOOK.md`, `LANE_WIRING_GHL.md`
- Live tenant: Moe Legacy org `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` (Supabase, RLS-fenced)
- Value ladder, GHL 11-stage pipeline, DREAMA voice agent (per AIXMOS launch package)

## What I'll do the moment files land
1. Triage: inventory every file, flag anything sensitive, summarize what we got.
2. Map to the existing system (what's new vs. duplicate vs. conflicting).
3. Propose a short prioritized build plan (stabilize → make sellable/ad-ready → networked).
4. Execute step by step, verifying each, before claiming done.

## Open loops to close (separate from the intake)
- Onboard Umar into `org_roles` (needs his Supabase signup OR a service key).
- Decide whether to push `master` (triggers prod deploy).
