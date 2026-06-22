# Claude Code — AIXMOS Build Page Integration

Paste this whole file into Claude Code at the root of the upstream AIXMOS repo. It tells the
agent how to fold the build page in and keep it 1:1 with the platform. It does not assume the
exact tree — step 1 is to discover it.

---

## CONTEXT

I'm adding a public **build page** (`index.html` + `aixmos.config.json`, in this drop) to the
AIXMOS repo. Every operator's machine renders as a permanent, shareable page (modules, tier,
crew, owner-gated bays, scan-to-load QR). It must stay **1:1** with the platform: same module
keys, same gated feature flags, same owner-approval rule (only Owner or Umar can clear the
credit/funding pair).

## TASK

1. **Discover the repo.** Read the existing structure, the shared schema(s), the feature-flag
   definitions, and the owner-approval / compliance-gate primitives. Report where modules,
   flags, and gates are currently defined.

2. **Reconcile the catalog — do not blind-overwrite.** Compare `aixmos.config.json` in this
   drop against the repo's real module list and flags:
   - If the repo already defines modules/flags, treat the repo as authoritative for **names
     and keys**, and update `aixmos.config.json` to match. Flag every diff for my review
     before changing keys.
   - Confirm the two gated bays map to real flags: `credit_to_keys → credit_repair + funding`,
     `dispatch → dispatch_overdrive`. If your flag names differ, align the config to the
     repo's names and tell me what you changed.
   - Verify approvers: credit/funding = `["owner","umar"]`, `dispatch_overdrive` =
     `["owner"]`. Match these to the repo's owner-approval primitive.

3. **Wire config as the single source of truth.** The `CONFIG` block embedded in `index.html`
   mirrors `aixmos.config.json`. Keep them in sync (codegen or documented manual mirror).
   `check-config-drift.mjs` already fails if the module keys / gated flags disagree — extend
   it or replace it with your codegen so the page, the JSON, and the platform schema never drift.

4. **Place the files** where static assets / web deliverables live in this repo. In TMMT they
   live at `tools/aixmos-build-page/`. Keep `index.html` self-contained.

5. **Pricing.** `computeTier()` in `index.html` uses the reconciled ladder
   (Operator $97 / Builder $297 / Node $997 / Partner $5K–$50K). True tier is earn-gate-driven
   in `aixmos-core.ts` — decide whether to wire real entitlements or keep the build-size proxy.

## HARD RULES

- **Do not** treat the UI gate as legal authorization. The unlock records an approver for
  provenance; real CROA / Virginia credit-services / dispatch licensing / insurance steps stay
  gated in the actual compliance flow. Keep that boundary intact and don't auto-unlock anything.
- **Do not** rename module `key`s or flag names without surfacing the diff for my approval —
  they're the contract that keeps everything 1:1.
- **Do not** add a backend, write secrets, or wire customer-facing or financial actions in this
  task. Stop at the static page + config reconciliation and report.

## OUTPUT

- A summary of the repo's existing module/flag/gate definitions and every diff against this drop.
- The reconciled `aixmos.config.json`, the synced `index.html` CONFIG block, and the drift check.
- A short note on where you placed the files and what's left for me to decide (pricing numbers,
  flag-name conflicts, file location).
- The proposed commit message.
