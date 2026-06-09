# Master Action Checklist

Everything to check and fix, **one item at a time**. Work top to bottom. Each
item says **who** does it and **how you know it's done**.

**Owner tags:**
- 🤖 **[Cursor]** — a code change in this repo. Cursor can do it.
- 👤 **[You]** — a setting in an external account (GitHub / Vercel / GHL / Supabase). Only you can.
- ⚖️ **[Decide]** — needs your decision before anyone acts.

---

## ▶️ Paste this to Cursor to start

> Work through `docs/ACTION-CHECKLIST.md` one item at a time, **🤖 [Cursor] items only**.
> For each: make the change on a feature branch, run `npm run build && npm test && npm run lint`,
> confirm the item's "Done when" is met, then check the box and move on. Skip 👤 and ⚖️
> items (those are mine) but remind me they exist. Never batch unrelated items into one commit.

---

## A. Security & access (highest priority)

- [ ] **A1 — 👤 Confirm collaborators on the 6 non-TMMT repos.**
  GitHub → each repo (`aixmos-gateway`, `AIXMOS-AGENTS`, `AIX-Command-Center`, `ai-command-center`, `PROJECTAIXMOS`, `aixmos-kit`) → Settings → Collaborators & teams. *(TMMT already verified: only you.)*
  **Done when:** every repo lists only people you intend.
- [ ] **A2 — 👤 Confirm account 2FA is on.** GitHub → Settings → Password and authentication.
  **Done when:** 2FA shows enabled.
- [ ] **A3 — 👤 Turn on Secret Scanning + Push Protection** for every repo. GitHub → repo → Settings → Code security → enable both.
  **Done when:** all 7 repos show both enabled (blocks future secret commits).
- [ ] **A4 — 👤 Branch protection on `master`** (TMMT + any active repo). Settings → Branches → add rule: require PR before merge, no force-push, no deletion.
  **Done when:** `master` can't be pushed to directly.
- [ ] **A5 — 👤/🤖 Definitive secret scan** (belt-and-suspenders; code-search found nothing but doesn't index 100%). Clone each repo and run `gitleaks detect` or `trufflehog git file://.`.
  **Done when:** each repo scanned, 0 real findings (rotate anything found).
- [ ] **A6 — 👤 Confirm Vercel/Supabase/GHL secrets live only in env**, never in code (TMMT confirmed clean). Spot-check the other repos' deploy configs.
  **Done when:** no live keys anywhere but the providers' env settings.

## B. Repo & branch hygiene

- [ ] **B1 — 👤 Fix `AIX-Command-Center` default branch.** It's currently `cursor/initial-workspace-bootstrap` (a feature branch). Settings → Branches → set default to `main`/`master`.
  **Done when:** default is a real main branch.
- [ ] **B2 — ⚖️ Decide which duplicate/stale repos to archive.** Candidates: `ai-command-center` vs `AIX-Command-Center` (two "command centers"), `aixmos-kit` (nearly empty), `PROJECTAIXMOS` (untouched since May 19).
  **Done when:** you've picked the keepers; archive the rest (Settings → Archive).
- [ ] **B3 — 👤/🤖 Delete merged feature branches** (do in GitHub UI → Branches, or via Cursor with push access — the cloud sandbox's git is blocked from deleting remote branches). All merged into master this session:
  `claude/open-ended-work-nmv15i`, `claude/high-ticket-build-funnel`, `claude/affiliate-payout-reporting`, `claude/owner-revenue-dashboard`, `claude/cleanup-polish`, `claude/qa-walkthrough`.
  Also from **closed** PRs: `cursor/venture-command-center-routes` (#3), `cursor/tmmt-management-initial-setup` (#1).
  **Done when:** `git ls-remote --heads origin` no longer lists them.
- [ ] **B4 — ⚖️ Investigate then delete other stale branches:** `claude/team-absence-notification-0rYgo`, `claude/tmmt-os-website-bwOu5`, `cursor/aixmos-landing-ghl-intake-embed`, `feat/ghl-supabase-integration`, `feature/rescue-dispatch-core`, and the stray **`main`** branch (default is `master`).
  **Done when:** each is confirmed merged/abandoned, then deleted.
- [ ] **B5 — ⚖️ PR #4 ("portal-docs-clarify") — exposes VIN + license plate to partners.** It is NOT on master (real pending change, not stale). Decide: **merge** (I'll rebase onto master first) or **close** (reject the VIN/plate exposure).
  **Done when:** #4 is merged or closed.

## C. Turn on money collection (high-ticket revenue)

Follow `docs/HIGH-TICKET-GO-LIVE.md`. All 👤 — they live in GHL/Vercel.

- [ ] **C1 — 👤 Create 4 GHL deposit products + 1 booking calendar**, each adding its success tag (`build-base-deposit`, `build-enterprise-deposit`, `build-carbox-deposit`, `build-ecom-deposit`, `build-ecosystem-consult`).
- [ ] **C2 — 👤 Set Vercel env:** `NEXT_PUBLIC_GHL_CHECKOUT_{3750,7500,15000,25000}`, `NEXT_PUBLIC_GHL_CONSULT_CALL`, `NEXT_PUBLIC_SUPPORT_PHONE/EMAIL`.
- [ ] **C3 — 👤 Point GHL payment automation** at `POST /api/webhooks/ghl` with header `x-ghl-webhook-secret` = `GHL_WEBHOOK_SECRET`. Confirm `GHL_WEBHOOK_SECRET` is set.
- [ ] **C4 — 👤 Set `/build/reserved`** as each deposit product's thank-you/redirect URL.
- [ ] **C5 — 👤 Test one deposit end-to-end** (Stripe test mode / $1 product): Reserve → pay → confirm a row appears on the admin **Payments** page (correct amount, `product_code` = `build_*`, status Paid) and a Pending balance row for tiers with a balance.
- [ ] **C6 — 🤖 Flip `/build` live** once C1–C5 pass: add a nav/funnel link to `/build` and remove `robots:{index:false}` from `src/app/build/page.tsx`. **Done when:** build passes and the page is linked.
- [ ] **C7 — 👤 Same for `/kits`** — set the `NEXT_PUBLIC_GHL_CHECKOUT_*` kit URLs so those CTAs go live.

## D. App QA — every page

- [ ] **D1 — 🤖+👤 Run the page-by-page walkthrough** in `docs/QA-WALKTHROUGH.md` (every route, all links/buttons, forms, dark mode, mobile, console). Tick its boxes as you go.
  **Done when:** the QA doc's sign-off table is all ✅.

## E. Engineering polish & roadmap (optional, do after A–D)

- [x] **E1 — 🤖 Lint cleanup** — ✅ **Done:** `npm run lint` exits 0 (errors fixed; remaining ~40 entries are intentional warnings — the documented `set-state-in-effect` admin idiom + framework `error`-prop conventions). Removed the safe dead code.
- [ ] **E2 — 👤 Activate Sentry** — set `NEXT_PUBLIC_SENTRY_DSN` in Vercel (SDK already installed). **Done when:** errors show in Sentry.
- [ ] **E3 — 👤 Retire duplicate Vercel projects** per `docs/THREE-APP-ECOSYSTEM.md` → `scripts/retire-vercel-duplicates.sh --apply` after the pre-flight sign-off.
- [ ] **E4 — 🤖+👤 File uploads (Gap #9) — already PARTIALLY built; do NOT build a parallel system.** A document-upload stack exists: `src/app/(admin)/document-actions.ts`, `forms/license-upload-actions.ts`, `workflow-actions.ts`, `src/lib/document-storage.ts` + Storage migrations (`20260512180000_document_uploads.sql`, workflow engine). **Remaining:** create the Storage bucket in Supabase (👤), then extend the existing pattern to fleet/maintenance photos (🤖). **Done when:** the existing uploaders are surfaced on the relevant admin pages.
- [ ] **E5 — 🤖 Email notifications** (Gap #10) — transactional email (needs a provider key from you) for form confirmations + fee notices.
- [x] **E6 — 🤖 Aggregate analytics charts** — ✅ **Done:** 6-month collected-revenue trend chart on `/revenue` (`revenueByMonth` + `RevenueTrendChart`, recharts).
- [x] **E7 — 🤖 Component/DOM tests** — ✅ **Done:** jsdom + Testing Library added; `StatusPill` + `ExportButton` covered. (Forms still TODO if you want more.)
- [x] **E8 — 🤖 Pure-logic test coverage** — ✅ **Done:** added tests for `site-domains` (owner-hub routing), `rate-limit`, `high-ticket`, `kit-checkout`, `ghl-links`. **78 unit tests total.**

## F. Final gates (re-run after any batch of changes)

- [ ] `npm run build` ✅
- [ ] `npm test` ✅ (currently **78 passing**)
- [ ] `npm run lint` ✅ (0 errors)
- [ ] Full route smoke ✅ (public 200, protected gated)
- [ ] No console errors on any page.

---

### Priority order
**A (security) → B (hygiene) → C (revenue go-live) → D (QA) → E (polish).**
A and C are the two that matter most: A keeps everything locked to you; C is what actually starts the money.
