# 01 — Product vision

Source: SPEC §1, §3, §23 · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "The three faces" and "Domains and where they stand" tables (master today). **TARGET** = "Target experience" (PM-16/PM-19; nothing of it exists in canon). The guiding principles are binding now. The assumptions are labelled and unconfirmed.

## One sentence

TMMT is **one operating system for rental and rideshare fleet operators**: one app (`tmmt-ops`), one database (Supabase), one tenant model, three faces.

## The three faces

| Face | Audience | Today |
|---|---|---|
| Customer Portal | renter, credit client | **MISSING in canon.** The two customer surfaces (`/status/[token]`, `/intake*`) are login-walled. A 15-page portal exists only in the TMMT-OS-ARCHIVE (rescued, owner URGENT) |
| Operator Console | operator staff, VAs, dealers | `(admin)` desk (29 screens) works. Operator portal home loops. Dealer desk exists only in the archive |
| Admin / Platform Console | platform owner | `/command` works. Integrations are env vars. GHL admin UI = GHL M12 |

## Domains and where they stand (SPEC §1 table)

| Domain | Status today |
|---|---|
| CRM / Leads | Lead store works (892 `incoming_leads`); one live feed (off-repo GHL poller) |
| Rentals | No state machine; `bookings` = 0 rows; the only writer creates `hold` |
| Fleet | Airtable-era data; all 27 `vehicles` inactive; two vehicle tables |
| Payments | No processor-verified proof of payment anywhere |
| Maintenance | Legacy screens over 4 rows |
| Credit Center | Real owner-operated engine, CROA-gated shut; no customer face |
| Communications | Nothing customer-facing sends; outbox has no drainer |
| Documents / Agreements | No e-sign; 0 signed agreements in Supabase |
| AIXMOS | SMS agent built but never ran; several features depend on local machines |
| Analytics | Read-only screens; KPI cron dead since 2026-05-20 |
| Admin / Integrations | Single env-token GHL; N-org registry only on unmerged GHL branches |

## Guiding principles (binding)

1. TMMT (Supabase) owns rental operational truth. **GHL never sets business state** [SoR §5.2].
2. One writer per field. Append, don't overwrite [SoR §5.1, §5.5].
3. The opt-out gate fails closed [SoR §5.6].
4. **No riba.** Late fees go to charity and are never revenue. Deposits are ʿarbūn. LTO is Ijārah Muntahia Bittamleek as two documents. Payments never allocate to interest. Collections show mercy. There are no guaranteed credit-score or financing claims.
5. Embedded agents get the same gates as people. They may draft, route, remind and roll up. They may not decide eligibility, move money, or send externally without the owner gate. **AIXMOS acts only through authenticated, scoped TMMT services.**
6. Money, send, sign and prod deploy stay owner-gated. Production writes require the prod write baton.

## Business assumptions (labelled; do not treat as facts)

| # | Assumption |
|---|---|
| A-1 | First tenant is the house operator "TMMT Rentals" (house org `8e651b25-…`), renting weekly to rideshare drivers |
| A-2 | Other operators (9 orgs in prod) license the platform; `packages` = entitlements, **not** a price book |
| A-3 | Vehicles are often owned by third-party partners with per-person, per-car split terms (`vehicle_owners` / `owner_agreements` MISSING) |
| A-4 | Owner decision (SQUARE ONE, 2026-09-01): no cars and no partners now; the live asset is ~890 leads + ~81 approved-never-placed. **Fleet data contradicts it** (21 `fleet` rows say 'Rented') |
| A-5 | Revenue streams are unconfirmed; no price book is authoritative (commercial-authority gate) |
| A-6 | Late fees are never revenue (owner rule, binding) |
| A-7 | Customer conversations stay in GHL; TMMT stores pointers only |
| A-8 | Credit readiness supports the rental journey (credit → LTO / drive-to-own), not standalone lending |
| A-9 | One Vercel project, one Supabase project, no staging DB |

## Target experience (SPEC §23)

- **Customer Portal** (proposed `/client/*`; the URL shape is an OWNER DECISION): home/status, documents upload, my rental, agreement to sign, billing, maintenance/support, Credit Center (education), updates.
- **Operator Console**: Today (`/desk`), Leads, Rentals, Fleet, Money (verified vs unverified), Documents, Work, Dealer, Team.
- **Admin Console**: command home, orgs/operators, integrations (GHL = M12), comms outbox approval, handoffs, credit desk (credit track), AIXMOS agents, security/health.

Prerequisites for any customer page: the customer auth path (PM-19), per-person RLS (PM-02), and no score or financing claims.
