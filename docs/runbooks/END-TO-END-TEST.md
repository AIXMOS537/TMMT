# END-TO-END TEST RUNBOOK

**Written 2026-09-16.** How to drive TMMT OS end to end on this machine, what is
genuinely testable today, and what is still blocked and why.

Every figure below was read live from production (`uapxakmlwnpfsftfeezx`) or
observed in an actual run. Nothing here is aspirational.

---

## 0. ONE-COMMAND STATUS

```bash
npm run check-env     # env gaps
npm run test          # unit: 118 files / 1851 tests
npm run build         # production build
npx playwright test --project=specs    # end-to-end
```

Last full run, 2026-09-16: **unit 1851/1851 green · build clean · tsc clean ·
eslint clean · e2e 12/12 green.**

---

## 1. ENVIRONMENT — what is set and what is missing

`.env.local` (gitignored, chmod 600). A backup of the previous file is at
`.env.local.bak-20260916`.

| Var | State | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set 2026-09-16 | publishable by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ set 2026-09-16 | **must be the `sb_publishable_…` key** |
| `TELEGRAM_BOT_TOKEN` / `_OWNER_CHAT_ID` | ✅ pre-existing | |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **missing — owner must add** | see below |

> 🔴 **The legacy anon JWT is DISABLED on this project as of 2026-09-16.**
> `get_publishable_keys` reports the legacy `anon` key with `disabled: true`.
> The live browser key is the modern `sb_publishable_…` one. Any doc or script
> still pasting the old `eyJ…` anon JWT will fail auth silently.

### The one thing the owner has to add

`SUPABASE_SERVICE_ROLE_KEY` is a **real secret** — it bypasses RLS entirely — so
it was deliberately NOT fetched and written into the repo by an agent. It already
exists on this machine in `~/.config/tmmt/free-lanes.env`.

**82 files** import the service client. Without the key you will see, and can
safely ignore for the rental flow:

```
[people] link failed: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
```

That path is fire-and-forget and is caught — a form submission still succeeds.
Add the key when you want the `people` spine, cron routes and ops routes live.

---

## 2. WHAT IS ACTUALLY BOOKABLE TODAY

`bookings.vehicle_id` is a foreign key to `vehicles`, **not** to `fleet`.
`fleet` holds 43 cars; `vehicles` holds **2**. So exactly two cars can be booked:

| Vehicle | Tier | Posted | Floor | Fleet status |
|---|---|---|---|---|
| 2017 Toyota Camry | economy | $350/wk | *(none)* | Available |
| 2013 Lexus RX450H | mid | $400/wk | $400/wk | Available |

Both are `Available` with real prices, so a genuine end-to-end rental **is**
possible today — on two cars. The other 41 need the bridge migration (§5).

---

## 3. THE RENTAL FLOW

### 3a. Quote (working, staff-only, read-only)

`POST /api/rental/quote` — signed-in staff only. Sends nothing, charges nothing,
writes nothing, so it needs no owner-approval gate.

```jsonc
{
  "tier": "mid",              // economy | mid | luxury — REQUIRED
  "make": "Lexus", "model": "RX450H", "year": 2013,
  "days": 7,
  "backgroundApproved": true, // false ⇒ zero coverage offered, not cheaper coverage
  "postedWeeklyPrice": "400", // the car's own price — BEATS the tier card
  "lowestPossiblePrice": "400"// hard floor
}
```

Refusals are `422` and are deliberate — the engine never falls back to a price:

| `reason` | Means |
|---|---|
| `no_pricing_rules` | rate card read back empty (RLS shut-out or emptied table) — **never treated as free** |
| `no_matching_rule` | no rule matches this vehicle |
| `below_floor` | the resolved rate is under this car's `lowest_possible_price` — **refused, never clamped up** |
| `not_priceable` | no posted price and no usable tier card |
| `insurance_required_background_not_approved` | coverage chosen that this renter cannot have |

### 3b. Hold (code ready, not exposed on a route yet)

`createBooking()` in `src/lib/rental-pricing/create-booking.ts` writes
`status: 'hold'` and nothing else. `insurance_verified` and
`lot_release_approved` are written `false` and are never set true there.

⚠️ **Confirming, capturing a deposit, or releasing the car are NOT in that file
and must not be added to it.** Those are financial/customer-facing actions and
route through `shared/owner-approval-gate/` per the repo's CLAUDE.md.

---

## 4. KNOWN-GOOD BEHAVIOURS WORTH RE-CHECKING AFTER ANY CHANGE

These are the guarantees most likely to rot silently:

1. **A below-floor quote is refused, not clamped.** The seeded card prices
   economy at $280/wk; the cheapest real car floors at $300. Clamping upward
   would hide that something tried to rent under the floor.
2. **`fleet.vehicle_class` is never read as a price tier.** Only 3 of 43 rows
   have one and all three are wrong in production (Model 3 → `sport_bike`,
   Model Y → `sport_suv`, 2013 Corolla → `sport_car`).
3. **A zero-row rate read is a refusal, not a free rental.**
4. **An unapproved background check yields NO coverage options**, not cheaper ones.
5. **Public lead intake actually inserts.** Regression-prone: `anon` has INSERT
   but not SELECT on `incoming_leads`, so any `.select()` after an insert fails
   the whole statement with `42501` and loses the lead. See
   `src/app/forms/insert-retry.test.ts`.

---

## 5. BLOCKED — needs the owner

| # | Blocker | Why it needs you |
|---|---|---|
| 1 | `20260916235900_bookings_no_double_booking.sql` | Production DDL. Proven on the throwaway project with every gate watched refusing, but must go through `PRODUCTION-MIGRATION-WORKFLOW.md`. **Until it runs, two simultaneous requests can both book the same car** — the app-level check cannot win that race. |
| 2 | `20260917000100_fleet_to_vehicles_bridge_resume.sql` | Needs your **tier decision**; unblocks 26 of 43 cars. Dry-run verified read-only: 26 correct rows, all at or above their floor. |
| 3 | Rate card numbers | 5 of 7 make/model rules match **zero** cars. See `docs/commercialization/PRICING_AND_CREDIT_GUARDRAILS_2026-09-16.md`. Your pricing, your call. |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` | A real secret; an agent should not copy it into the repo tree. |

---

## 6. TWO THINGS TO BE AWARE OF

**The E2E suite writes to PRODUCTION.** `e2e/smoke.spec.ts` submits the real
lead-intake form, so each run adds a `Test User / test@example.com` row to
`incoming_leads`. Five such rows exist (2026-08-25, three on 09-10, one on
09-16). Harmless but real; filter them out of any lead count, or point the suite
at a throwaway project before running it often.

**Dependabot reports 10 vulnerabilities on the default branch** (4 critical,
3 high, 3 moderate): https://github.com/AIXMOS537/TMMT/security/dependabot —
untouched here, worth a pass before any customer install.

---

## 7. AN API REFUSAL IS AN HTML LOGIN PAGE — open design question

Middleware answers a signed-out request to a protected `/api/*` path with a
`307` to `/login`. A programmatic client follows it, gets `200` + HTML, and a
naive caller can read that as success. The refusal is genuinely fail-closed —
no data escapes — but it is not machine-readable.

This is **deliberate and explicitly tested**: `src/middleware.test.ts` has cases
named *"/api/pocket/chat redirects to /login"* and *"client factory throws
(missing env) → redirect to /login, never 500"*. Changing it would alter a
tested contract across `/api/cron`, `/api/ops`, `/api/pocket` and
`/api/offline`, so it was **left alone**. If you want JSON 401s for API paths,
that is a deliberate decision to make, not a cleanup edit.
