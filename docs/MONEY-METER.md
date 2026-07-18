# Money Meter — one meter for every dollar

> Sort of like OmniRouter's live meter, but for the whole business. Tracks money
> **USED**, **SAVED**, and **COLLECTED** across any and all things AIXMOS/TMMT
> builds, buys, or bills. **Owner + family are free forever.**

## What it is

Before this, money tracking was fragmented across four disconnected systems: the
TMMT token ledger (internal credits), `customer_payments`/`revenue.ts` (sales),
the CLI deal ledger (`scripts/deal.sh`), and a per-call `costUsd` in the SMS
agent that was **computed but never stored**. The Money Meter is the single
ledger that unifies the money picture.

Three directions, recorded on every relevant code path:

| Direction   | Meaning        | Examples |
|-------------|----------------|----------|
| `collected` | money **in**   | memberships, deposits, TMMT-token buys |
| `used`      | money **out**  | cloud AI/LLM calls, SMS, subscriptions, ad spend, commission payouts |
| `saved`     | money **avoided** | serving on the local brain instead of cloud, negotiated discounts |

The **net** line is `collected − used(billable)`.

## Free forever (owner + family)

Anything the owner and family run is **free forever**. Their usage is still
*recorded* so the meter shows what it *would* have cost (full visibility), but
every `used` event on a free-forever org is stamped `billable = false`, so their
net billable spend is always **$0**. This is enforced in code — the DB function
`money_meter_record` sets `billable = false` for free-forever orgs — not a comment.

- The owner's home org is seeded free-forever in migration `20260718000000`.
- That same migration wires the long-designed-but-never-set **owner token
  bypass**: the owner org's `tmmt_token_balances.unlimited` is flipped to `true`,
  so the owner is never metered in TMMT tokens either.
- Add **family/personal** orgs the same way — either:
  - SQL: `insert into money_meter_accounts (org_id, free_forever, label) values (…, true, 'family')` and flip their token balance `unlimited = true`; or
  - Code: `setOrgFreeForever(service, orgId, 'family')`; and
  - App layer: add their email to `MONEY_METER_FREE_FOREVER_EMAILS` (comma-separated). The owner email is always free even if that env is blank.

## Where it's wired

- **Ledger + RPC:** `supabase/migrations/20260718000000_money_meter.sql`
  (`money_meter_events`, `money_meter_accounts`, `money_meter_record`). Same
  security posture as the token ledger: RLS read-own-org (staff bypass), writes
  are service-role only, append-only, `dedupe_key` makes recording idempotent.
- **Module:** `src/lib/money-meter.ts` — pure summarizers (`summarizeMoney`,
  `summarizeByCategory`), free-forever helpers (`isFreeForever`), and service-role
  wrappers (`recordMoneyEvent`, `recordMoneyEventSafe`, `getMoneyEvents`,
  `setOrgFreeForever`). Tests: `src/lib/money-meter.test.ts`.
- **Dashboard:** `/money` (`src/app/(admin)/money/page.tsx`) — Used / Saved /
  Collected / Net stat cards, free-forever value, and a by-category table.
  Collected is read from the payments ledger (revenue source of truth) so revenue
  is never double-counted.
- **Recording call sites (today):**
  - `src/lib/agent/process-inbound.ts` — books the **real cloud LLM cost** of the
    SMS sales agent as `used` (the gap where `costUsd` was computed but dropped).
  - `src/app/api/pocket/chat/route.ts` — books the cloud-equivalent cost of each
    Pocket job as `saved` (served on the owner's local brain).
  - All recording is best-effort (`recordMoneyEventSafe`) — a metering hiccup
    never breaks the real work.

## Extending it

To meter a new money path, call one line at the site where the money moves:

```ts
import { recordMoneyEventSafe } from "@/lib/money-meter";

await recordMoneyEventSafe(serviceRoleClient, {
  orgId,                 // null = platform-level spend
  direction: "used",     // "collected" | "used" | "saved"
  category: "sms",       // ai_llm | sms | subscription | ad_spend | commission | sale | …
  amountUsd: 0.0075,
  source: "twilio",
  dedupeKey: `sms:${messageSid}`, // idempotent when you have a real id
});
```

**Owner-approval note:** the meter is observational — recording an event does not
move money, so it does not route through the owner-approval gate. Any code that
actually *charges, pays, or transfers* still terminates at
`shared/owner-approval-gate/` as always; meter it after the approved action runs.
