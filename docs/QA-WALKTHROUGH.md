# TMMT — Page-by-Page QA Walkthrough

A complete manual walkthrough of every page. Hand this whole file to Cursor (or
work it yourself) and go **one page at a time**: open it, run the checks, tick
the boxes, and fix or log anything that's off.

---

## ▶️ Paste this to Cursor to start

> You are doing a page-by-page QA pass of this Next.js + Supabase app using
> `docs/QA-WALKTHROUGH.md`. Work through it **top to bottom, one page at a
> time**. For each page:
> 1. Start the dev server (`npm run dev`) and open the route in a browser.
> 2. Run every checkbox under that page. Check the browser **console** and
>    **network** tab for errors/failed requests on each.
> 3. If something is broken or ugly: if it's a small, safe fix (broken link,
>    wrong label, dead button, spacing, dark-mode contrast), fix it and note
>    what you changed. If it's ambiguous or larger, STOP and ask me.
> 4. Tick the box (`- [x]`) when a page passes; add a `> NOTE:` line under any
>    box that needed a fix or that I should review.
> Do **not** batch-edit across pages — verify each page works before moving on.
> After each section, run `npm run build` and `npm test` to confirm nothing broke.

---

## Setup (do once)

- [ ] `cp .env.example .env` and fill **Supabase** keys (required) — see `README` / `docs/`.
- [ ] `npm install`
- [ ] `npm run check-env` — confirms Supabase reachability.
- [ ] `npm run dev` → http://localhost:3000
- [ ] Have **test logins for each access tier** ready (role is `app_metadata.role` in Supabase Auth — see `docs/PARTNER-PORTAL.md`):
  - `admin` → **owner** (sees everything, incl. `/command`)
  - none / `internal_team` / `va` → **staff** (all ops/admin pages)
  - `executive` → `/executive`
  - `operator` → `/operator`
  - `vendor` → `/vendor`
  - `investor` or `partner` → `/investor`, `/partner`
- [ ] For the `/learn/*` program funnel: a **deep link** with `?applicationId=<id>&token=<access_token>` (created via the onboarding flow / GHL webhook). Without it those pages won't have data.

---

## Global checks — apply to EVERY page

- [ ] Loads with **no console errors** and no failed network requests.
- [ ] **Dark mode** toggles cleanly (top-right toggle) — text/contrast OK in both themes.
- [ ] **Responsive** — usable at mobile width (375px), tablet, desktop.
- [ ] No layout shift / overflow / clipped content.
- [ ] All **links and buttons** go somewhere correct (no `#`, no 404, no dead handlers).
- [ ] Loading state shows a spinner; error state shows a friendly message (not a crash).

---

## 1. Auth & account (public)

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/login` | Email+password fields; **"Forgot password?"** link → `/login/forgot`; wrong creds show "Invalid email or password."; correct creds redirect to the right home per role. |
| [ ] | `/login/forgot` | Enter email → "Send reset link" → success message ("if an account exists…"); **does not** reveal whether the account exists; "Back to sign in" link works. |
| [ ] | `/login/reset` | New + confirm password; rejects < 8 chars and mismatch; on success redirects to the role home. (Reach it via the email link → `/api/auth/callback`.) |

- [ ] Visiting any protected page while logged out → redirects to `/login`.

---

## 2. Public forms (no login)

Each form: required-field validation blocks empty submit, a valid submit shows a
**"Thank You"** confirmation, and re-submitting many times triggers the rate
limit (5/hr). Check the submitted row lands in Supabase.

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/forms/lead-intake` | "Vehicle Rental Inquiry"; name + phone required; submit → Thank You. |
| [ ] | `/forms/customer-intake` | Full intake; submit → confirmation. |
| [ ] | `/forms/appointment` | Date/time + fields; submit. |
| [ ] | `/forms/ticket` | Issue-type dropdown present; submit. |
| [ ] | `/forms/waitlist` | Submit → confirmation. |
| [ ] | `/forms/background-check` | Submit. |
| [ ] | `/forms/handover` | Submit. |
| [ ] | `/forms/inspection` | Submit. |
| [ ] | `/forms/onboarding-inspection` | Submit. |
| [ ] | `/forms/license-upload` | File/license fields render. |
| [ ] | `/forms/affiliates` | Affiliate program copy + apply CTA; compliance language (no "guarantee"/"fix credit"). |

---

## 3. Sales / revenue funnel (public, unlisted)

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/kits` | 3 kits + Dealer Bundle; prices correct; "Buy online"/"Buy + ship USB"/"Apply as operator" links go to checkout (or `#checkout-pending` if env unset); "How it fits together"; footer **Staff login** link. |
| [ ] | `/build` | 5 tiers ($3,750–$50,000); deposits correct; **"Reserve your build"** → deposit checkout (or fallback to book-a-call); $50k tier shows **"Book a strategy call"**; "Most popular" badge on Car Rental in a Box; "Questions? Book a call" per tier; anchor `#tiers` works. |
| [ ] | `/build/reserved` | Confirmation + 3 next-steps; "Book your kickoff call" CTA; "← Back to builds" link. |

> See `docs/HIGH-TICKET-GO-LIVE.md` — until GHL checkout URLs + env are set, the buy CTAs intentionally fall back to the consult link (no dead buttons).

---

## 4. Owner / staff dashboard & revenue

Login as **staff** (and again as **owner** for `/command`).

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/` (Dashboard) | 8 StatCards populate; **"Your Mission Now"** MissionBoard renders with live counts (overdue/tickets/checks/leads or "All clear"); Recent Leads & Recent Tickets lists; **"View all →"** links go to `/leads` and `/tickets`. |
| [ ] | `/revenue` | 4 StatCards (Collected this month / Recurring / Outstanding / Overdue); **Revenue by product** table; **Top affiliates** table; both **Export CSV** buttons download; all-time collected footer. |
| [ ] | `/affiliates` | StatCards (affiliates / paid sales / gross / commission owed); per-affiliate table; **Export CSV**; search filters by code; empty-state message when no attributed sales. |

---

## 5. Admin list pages (staff)

**Every** page here shares the same pattern — run this checklist on each:

- [ ] Loads; data table populates (or shows empty message).
- [ ] **Search** box filters rows.
- [ ] **Status filter** dropdown filters (where present).
- [ ] **Row click → modal** opens with the record's fields.
- [ ] Edit a field → **Save** → "Saving…" → modal closes → row updates (persists on reload).
- [ ] Inline **ErrorBanner** shows on a failed save (don't leave broken).
- [ ] **Export CSV** downloads the **currently filtered** rows; opens cleanly in a spreadsheet.
- [ ] "New / Add" button opens a blank modal and creates a record.

| ✅ | Route | Notes specific to this page |
|---|---|---|
| [ ] | `/leads` | Lead pipeline; status badges. |
| [ ] | `/background-checks` | Eligibility filter. |
| [ ] | `/waitlist` | |
| [ ] | `/appointments` | |
| [ ] | `/customers` | Active customers. |
| [ ] | `/payments` | Status (Paid/Pending/Overdue) + method. |
| [ ] | `/former-customers` | |
| [ ] | `/do-not-rent` | "Add to List" is a **danger** button. |
| [ ] | `/fleet` | Vehicle status. |
| [ ] | `/inspections` | |
| [ ] | `/maintenance` | **Inline StatusPill**: click the Status badge → dropdown; picking **No-Show/Late** auto-sets the fee and saves immediately (no modal). |
| [ ] | `/insurance` | |
| [ ] | `/tickets` | Priority + status badges. |
| [ ] | `/expenses` | Total in header. |
| [ ] | `/contracts` | |
| [ ] | `/vendors` | |
| [ ] | `/operation-costs` | Monthly total in header. |
| [ ] | `/cases` | Workflow cases; status chips; "Public intake" link → `/forms/customer-intake`; CSV export. |
| [ ] | `/workflow-vendors` | Outside vendors; portal access UUID field. |

### Form fields to verify (open each modal and confirm every field renders, accepts input, and saves)

- **`/leads`** — Contact Name · Opportunity Name · Phone · Email · Status · Priority Level · Notes
- **`/background-checks`** — Customer Name · Phone · Email · Own Insurance? · Eligibility Status · BG Check Status · Insurance Check Status · Earnings Verification · Date Verified · Verification Form Submitted? · Review Notes
- **`/waitlist`** — Customer Name · Phone · Email · Vehicle Type · Make · Model · Year · Desired Weekly Payment · Status · Date Added · Notes
- **`/appointments`** — Appointment Type · Date & Time · Vehicle Preference · Status · Staff · Location · Notes
- **`/customers`** — Customer Name · Phone · Email · Status · Repo Status · Rental Start Date · Payment Amount · Payment Frequency · Payment Rating · Ticket Balance · License Plate · VIN · Service Notes
- **`/payments`** — Customer · Phone · Amount · Payment Method · Payment Status · Last Payment Date · Next Due Date · Notes
- **`/former-customers`** — Customer Name · Email · Phone · Vehicle Rented · License Plate · VIN · Start Date · End Date · Last Payment · Reason for Removal · Notes
- **`/do-not-rent`** — Person/Entity Name · Email · Phone · Source of Restriction · Alert Category · Date Added · Reason for Restriction · Notes
- **`/fleet`** — Vehicle Name · Partner Name · Year · Make · Model · Color · Status · Type · License Plate · VIN · Mileage · Lowest Price · Finance Status · Partner % · Partner portal notes (investors only) · Notes
- **`/inspections`** — Inspection Name · Inspector Name · Date · Odometer Reading · Status · Inspection Type · Follow-up Needed? · Next Scheduled · Notes
- **`/maintenance`** — Maintenance Type · Customer (if applicable) · Date & Time · Status · Assigned Staff · Service Provider/Location · Fee (No-Show/Late) · Notes
- **`/insurance`** — Insured Vehicle · Insured Customer · Entity Type · Insurance Company · Policy # · Policy Type · Coverage Amount · Deductible · Start Date · End Date · Status · Renewal Reminder · Notes
- **`/tickets`** — Customer · Citation # · Violation Type · Amount · Priority · Status · Date Created · Follow-up Date · If 'Others', specify type · Date Closed · Description / Issue Details · Internal Notes
- **`/expenses`** — Vehicle Name · Expense Type · Amount · Vendor/Payee · Date · Status · Assignee · Description · Notes
- **`/contracts`** — Customer · Status · Start Date · End Date · Base Price · Taxes & Fees · Insurance Fee · Total Amount · Contract Sent Date · Signed Date · Notes
- **`/vendors`** — Vendor/Payee Name · Phone · Email · Point of Contact · Notes
- **`/operation-costs`** — Tool/Software Name · Type · Cost · License Status · Description
- **`/cases`** — Status · ClickUp task ID · ClickUp URL · Internal notes · Vendor · Job title · Instructions
- **`/workflow-vendors`** — Business name · Service verticals · Agreement status · Notes · Contact name · Email · Phone · Supabase Auth user ID (UUID)

### Interfaces (read-style views)
| ✅ | Route | Check |
|---|---|---|
| [ ] | `/interfaces/appointments` | Loads + renders. |
| [ ] | `/interfaces/contracts` | |
| [ ] | `/interfaces/vehicles` | |
| [ ] | `/interfaces/payments` | |

---

## 6. Sidebar & navigation (staff/owner)

- [ ] **Every sidebar link** opens the right page and the active item is highlighted.
- [ ] Collapsible groups (Overview, Interfaces, Workflow, Pipeline, Customers, Fleet, Operations) expand/collapse.
- [ ] **Sign out** logs out → `/login`.
- [ ] Theme toggle in the sidebar works.
- [ ] On mobile, the hamburger opens/closes the sidebar.

---

## 7. Dispatch (staff/owner)

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/dispatch` | Board loads. |
| [ ] | `/dispatch/me` | "My" view. |
| [ ] | `/dispatch/responders` | List + actions. |
| [ ] | `/dispatch/units` | List + actions. |
| [ ] | `/dispatch/incident/new` | Create form; submit creates an incident. |
| [ ] | `/dispatch/incident/[id]` | Open a real incident; detail + status transitions. |

---

## 8. Command center (owner only)

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/command` | Portfolio/command hub loads. |
| [ ] | `/command/desk` | AI command desk; send a message; "Apply AI fix" / approve actions work; no console errors. |

---

## 9. Role portals (log in as each role)

| ✅ | Route | Access | Check |
|---|---|---|---|
| [ ] | `/executive` | executive | Loads; role content; no access to staff-only pages. |
| [ ] | `/operator` | operator | Loads. |
| [ ] | `/vendor` | vendor | Vendor portal; assigned jobs; updates/files. |
| [ ] | `/investor` | investor/partner | Read-only investor view. |
| [ ] | `/partner` | investor/partner | Partner portal. |
- [ ] Each role is **blocked** from other tiers' pages (redirect, not error).

---

## 10. AIXMOS program funnel — `/learn/*` (needs a deep link)

Open with `?applicationId=<id>&token=<access_token>`. Walk the flow in order:

| ✅ | Route | Check |
|---|---|---|
| [ ] | `/learn/onboarding` | Entry; deep-link token accepted. |
| [ ] | `/learn/questionnaire/personal` | Fields save; progresses. |
| [ ] | `/learn/questionnaire/business` | Fields save. |
| [ ] | `/learn/products` | Product matches / fit scores render; disclaimer present. |
| [ ] | `/learn/documents` | Upload fields. |
| [ ] | `/learn/application/review` | Review all data; coach/admin sign-off (role-gated section). |
| [ ] | `/learn/consent` | Consent gate before submit. |
| [ ] | `/learn/status` | Submission tracker + audit log. |
| [ ] | `/learn/dashboard` | Readiness score. |
| [ ] | `/learn/coach` | Coach view (role-conditional). |
- [ ] **"Continue/Next/Back"** links move correctly between steps.

### Work side (`/work/*`, staff/role)
| ✅ | Route | Check |
|---|---|---|
| [ ] | `/work/admin` | Loads. |
| [ ] | `/work/program` | Loads. |
| [ ] | `/work/review` | Review actions. |
| [ ] | `/work/supervisor` | Supervisor actions. |

---

## 11. Cross-cutting link audit

- [ ] No anchor lands on a `#pending`/`#` placeholder unintentionally (the `/build` & `/kits` fallbacks are intentional until GHL env is set).
- [ ] Footer **"Staff login"** links on `/kits` and `/build` work.
- [ ] Post-login redirect sends each role to its correct home.
- [ ] 404/unknown route behaves sensibly.
- [ ] Browser back/forward doesn't break state.

---

## Sign-off

| Section | Status | Notes |
|---|---|---|
| 1. Auth | ⬜ | |
| 2. Public forms | ⬜ | |
| 3. Sales funnel | ⬜ | |
| 4. Dashboard & revenue | ⬜ | |
| 5. Admin list pages | ⬜ | |
| 6. Sidebar/nav | ⬜ | |
| 7. Dispatch | ⬜ | |
| 8. Command center | ⬜ | |
| 9. Role portals | ⬜ | |
| 10. Program funnel | ⬜ | |
| 11. Link audit | ⬜ | |

**Final gates:** `npm run build` ✅ · `npm test` ✅ · `npm run lint` ✅ · no console errors anywhere.
