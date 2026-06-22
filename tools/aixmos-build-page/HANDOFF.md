# AIXMOS Build Page — Session Handoff & Reconciliation Log

*Self-contained. Paste into another chat or Claude Code to continue.* The same text is
embedded in `index.html` (Spec & handoff ↗ in the footer) so it travels with the app.

---

## 1. WHAT THIS IS

A permanent, shareable **build page** for every operator's AIXMOS machine — same pattern as a
PinkSlips car-build page (`pinkslips.app/owner/build-name`), rebuilt in TMMT brand
(gold-on-black, holographic). "Build the machine": operators pick only the parts they need,
assemble their own machine, and grant their crew access. Converged on a PinkSlips-style profile
page per operator.

**Deliverable:** one self-contained `index.html` (no build step, works offline) + a config
mirror, deploy guide, Claude Code integration prompt, and a drift check.

## 2. FEATURE INVENTORY

- **Per-operator builds** — each operator = a machine with modules, crew tiers, tier/rate,
  accent colour, and its own page. Switch via pills; "＋ New build" sets owner/callsign/build/accent.
- **Hero** — holographic hex "core" lights node-by-node as modules install; tier badge, rate,
  live status (COLD / BUILDING / ONLINE), readiness %.
- **Spec sheet** — owner, callsign, tier, rate, modules, readiness, crew, gated-cleared, accent.
- **Build list** — Installed vs Available bays; tap to install/remove.
- **Gated bays** — `credit_to_keys` and `dispatch` ship locked; tapping opens an owner-approval
  modal that requires choosing an approver, then unlocks + installs. Grant is recorded.
- **Dyno** — capability output bars (Automation / Revenue Ops / Compliance / Network / Service).
- **Build log** — staged timeline; gated entries read "Access cleared by {approver}".
- **Crew roster** — 4 access tiers (Operator / Partner / Crew / Client), tap to wire/unwire.
- **Handoff** — Scan-to-load QR + Copy link + Save QR; top-bar Share copies the same deep link.
- **Persistence** — `localStorage` standalone (artifact storage API when embedded). Auto-saves.

## 3. CONFIG — SINGLE SOURCE OF TRUTH

Lives in `aixmos.config.json`, mirrored in the `CONFIG` block at the top of `index.html`.
`check-config-drift.mjs` fails if the two disagree on module key / gated / flags / approvers.
Keep `key`s stable — they map to the platform schema.

**Modules** (order = node order) — *reconciled v1.1*:

| key | name | gated | flags | approvers | maps_to |
|---|---|---|---|---|---|
| fleet_engine | Fleet Engine | — | — | — | workstream-1 · Fleet Economics Command Center |
| intake_gate | Intake Gate | — | — | — | AIXMOS Intake & Triage Gate (n8n) |
| ai_brain | AI Brain | — | — | — | Ollama + Workers tiered routing |
| dropnet | DropNet | — | — | — | AIXMOS DropNet (NAS file tier) |
| credit_to_keys | Credit-to-Keys | ✅ | credit_repair, funding | owner, umar | workstream-2 credit-funding vertical |
| operator_network | Operator Net | — | — | — | workstream-3 operator network ($97/mo) |
| dispatch | Dispatch | ✅ | dispatch_overdrive *(confirm)* | owner | Operation Overdrive (licensing gate) |
| detail_bay | Detail Bay | — | — | — | TMMT Auto Detail |

**Pricing ladder** (`computeTier()`, build-size proxy for the real `aixmos-core.ts` ladder):
Operator $97 (1–3 mods) · Builder $297 (4–5) · Node $997 (6+) · Partner $5K–$50K (any gated).

## 4. OWNER-APPROVAL + COMPLIANCE BOUNDARY

- Real legal flags: `credit_repair` + `funding`, unlockable **only** by `owner` or `umar` after
  the required legal steps.
- A2P SMS: credit repair, funding, debt relief, lending verticals are prohibited from
  promotional SMS (carrier + CROA). Transactional-only.
- **HARD LINE:** the build-page gate is *not* legal sign-off. Real CROA / Virginia
  credit-services / dispatch + courier licensing / insurance clearance stays in the actual
  compliance flow. The unlock records that those steps were done — it does not perform or
  replace them. **Never auto-unlock.**

## 5. SHARE / HANDOFF MECHANICS

- **Build code:** `AIX1.<base64(JSON)>` (name, callsign, build name, accent, build, access,
  unlocked, grants).
- **Deep link:** `{host}/#load=<urlencoded code>` → rebuilds that exact machine as a new build.
- **Pretty hash:** switching builds sets `#/owner-slug/build-slug` (bookmarkable).
- **QR** encodes the deep link (qrcode-generator via cdnjs, text fallback if offline/too large).

---

## RECONCILIATION LOG (config v1.0 → v1.1)

Reconciled against the upstream AIXMOS Claude Code repo (aixmos-packet, aixmos-core.ts,
aixmos-parts.ts, shared compliance/owner-approval gates).

### Corrected

| What | Was | Now |
|---|---|---|
| Legal feature flags | `credit_funding` | `credit_repair` + `funding` |
| Approver roles | `Owner` / `Umar` | `owner` / `umar` (display capitalized) |
| Pricing ladder | $97 / $297 / $697 / "from $50K" | **Operator $97 / Builder $297 / Node $997 / Partner $5K–$50K** |
| DataRoom | `dataroom` | `dropnet` / "DropNet" (the real named NAS file tier) |
| Module key | `operator_net` | `operator_network` |

### Still needs confirmation

1. **`dispatch_overdrive`** flag name is provisional — Operation Overdrive may be gated by
   licensing config, not a feature flag. Confirm against the real repo.
2. **Parts registry** — modules should map onto `aixmos-parts.ts` registered parts (doctrine:
   register parts, never code into core). The page hardcodes the 8; ideal end-state reads the
   registry.
3. **Crew roster** — current Operator/Partner/Crew/Client vs the real access tiers (Public /
   Operator-Owner / Employee-Vendor / Full $50K) and the archetype axis (Closer / Mechanic /
   Financier / Operator). Decide which the roster should mirror.
4. **Tier source** — true tier is earn-gate-driven in `aixmos-core.ts`; the page uses a
   build-size proxy for display. Decide whether to wire real entitlements.

### Note on this (TMMT) repo

This drop lives in the TMMT repo at `tools/aixmos-build-page/`. The upstream paths referenced
above (`shared/compliance-gates/`, `aixmos-core.ts`, `aixmos-parts.ts`) are the *AIXMOS
platform* contract names, not files in this repo. TMMT's own compliance config lives in
`config/credit-compliance.json` and `src/lib/verticals/registry.ts`; the build-page modules are
a display layer that must keep the same module keys/flags as the platform. Don't blind-rename.
