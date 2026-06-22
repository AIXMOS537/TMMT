# CHANGES — operating-layer-sync

Branch: `operating-layer-sync`
Date: 2026-06-22
Author: Muhammad Taha (PROJECT X HAILMARY) via Claude Code

---

## What changed

### CREATED — `AIXMOS_OPERATING_LAYER.md` (repo root)
The source of truth that was missing. Synthesized from:
- `CLAUDE.md` (architecture, owner-approval gate, compliance flags)
- `~/Projects/aixmos-gateway/src/index.js` (TIERS, COST constants → §3 cost routing)
- `OPERATIONS_BRAIN.md §6` (KPIs → §4.3 escalation thresholds)
- `OPERATIONS_BRAIN.md §7` (scripts → §6 template reference)
- `AIXMOS-COMMAND/MOE-LEGACY/06-ASCENSION-AUTOMATIONS.md` (A1–A7 → §4 intake gate, §5 Moe Legacy routing)
- `docs/superpowers/specs/2026-05-30-aixmos-neuroadaptive-command-intelligence-design.md` (GREEN/YELLOW/RED, trust ladder)

Sections:
1. Purpose
2. Architecture nouns
3. Cost routing — 80/20 rule + per-role caps
4. Intake gate — webhook → Ollama → routing matrix + Section 6 escalation thresholds
5. Credit-funding → Moe Legacy node (never to owner)
6. Section 7 response templates (reference + quick-ref table)
7. Owner-approval gate (what requires it, enforcement layers, trusted escalation path)
8. Compliance — gated flags registry
9. n8n flows (BRAINIAC) — flow list
10. Idempotency guarantee

### CREATED — `docs/AIXMOS_MASTER_PROJECT.md`
The full reference doc that `CLAUDE.md` line 3 has pointed to since the AIXMOS launch build but which never existed. Covers: codebase map, database tables, agent squad, product stacks, operator program, Moe Legacy partner program, security posture, deploy policy, open items.

### CREATED — `docs/n8n/README.md`
Stub spec for the 7 n8n flows (FLOW-01 through FLOW-07) that run on BRAINIAC. Describes each flow's trigger, guards, actions, and fail-closed behavior. Includes export/restore instructions. Actual flow JSON files live inside n8n on BRAINIAC — export them to `docs/n8n/flows/` when you want version-controlled backups.

### CREATED — `docs/compliance/feature-flags.md`
Full registry of every compliance-gated flag: `CREDIT_MODULE`, `FUNDING_MODULE`, `EQUITY_INSTRUMENT`, `SCREEN_MONITOR`, `PARTNER_LICENSE_REVOKE`, `FULL_RESELLER_KIT`. For each: current state (LOCKED), flag owner, legal prerequisite, what it gates. Includes the unlock process and the Umar note. No flags were changed — this is documentation only.

### CREATED — `kb/section-6-kpis.md`
Importable copy of `OPERATIONS_BRAIN.md §6` — KPIs, daily huddle format, weekly stoplight, escalation thresholds. Keeps the repo self-contained for agent context loading.

### CREATED — `kb/section-7-scripts.md`
Importable copy of `OPERATIONS_BRAIN.md §7` — phone and text scripts for Bibbs, Sumaima, Areesha, Rida. Includes banned-word list, agent draft rules, and Javeria content templates.

### EDITED — `CLAUDE.md` — BLOCKED by pre-commit hook
Attempted to add one pointer line to the top of CLAUDE.md. The pre-commit hook (managed by `aixmos-launch/install.sh`, the `<!-- AIXMOS-LAUNCH-RULES:START -->` block) reverted the file and unstaged the change. CLAUDE.md is machine-managed and cannot be edited via a normal commit.

**Decision needed (owner):** To wire the pointer in, you must either:
  a) Edit the source packet that `install.sh` injects, then re-run `install.sh`, or
  b) Add the pointer line manually above the `<!-- AIXMOS-LAUNCH-RULES:START -->` comment — that region is not managed by the hook.

The CLAUDE.md edit was skipped from this commit. All 6 other files committed cleanly.

---

## What was NOT changed

- No compliance flags were enabled, defaulted-on, or removed.
- No credit-repair or funding features were unlocked.
- No owner-approval gate was weakened.
- No Moe Legacy routing was changed — A1/A2 automations already route correctly per the existing spec.
- No files were deleted.
- No gateway code was touched (`~/Projects/aixmos-gateway/` is a separate repo).
- No Supabase migrations were applied.

---

## Idempotency

Re-running this branch (merging it again after a reset) produces zero new changes:
- All new files are creates, not modifications (except the one CLAUDE.md line).
- The CLAUDE.md edit is a single pointer line — re-applying it would be a no-op if already present.
- No code logic was changed; all changes are documentation and spec.

---

## Ambiguous items — decisions needed

| Item | Question |
|------|----------|
| Per-role daily caps (§3.2) | I defined caps as 300/1,000/unlimited tokens. These are reasonable defaults from the gateway code but were never formally set. Confirm or adjust before treating them as policy. |
| N in A5 lease-qualified check | Flow-05 says "N consecutive on-time weeks (suggested 8–12)." The actual N has never been defined. Set it before enabling this flow. |
| `kb/` directory | New `kb/` folder was created for importable KB copies. If you prefer a different path (e.g. `docs/kb/`), rename before merging — it's not wired into any code yet. |
| n8n flow JSON exports | `docs/n8n/flows/` folder is empty — flow specs are documented here but actual JSONs live in BRAINIAC's n8n. Export them when convenient. |
| `AIXMOS_MASTER_PROJECT.md §10` open items | I copied open items from the June 2026 session digest. Some may be resolved. Strike them from §10 once verified. |
