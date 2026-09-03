# 30 · STOP BUILDING THIS

Every item below is supported by evidence from this audit. The test applied: **does this have a paying customer, or is it complexity being funded by hope?**

## 1. 🔴 Multi-tenancy / white-label / dealer SaaS — **STOP**
- `dealer_applications` = **0 rows**. There is no demand signal at all.
- 9 organizations, effectively **one** real business.
- **It is actively destroying revenue:** `OrgRowShapeError` (184 lost leads) comes directly from the 2026-08-27 host-tenancy work.
> A feature built for customers who do not exist is breaking intake for the customer who does. Freeze it. The DB isolation work already done will keep.

## 2. 🔴 The dispute engine — **STOP until legal sign-off**
- Nine tables **never applied to production**; three UI routes and a CSV importer built against them.
- Performing disputes is **regulated credit-repair activity**; TMMT is a Maryland LLC (MCSBA licence + bond, no advance payment).
- This is legal exposure, not a feature gap. **No more code until a lawyer's opinion is in the repo.**

## 3. 🔴 The parallel rental schema (`bookings`/`vehicles`/`payments`) — **STOP adding to it**
- All three have ~0 rows and **zero application references**.
- They are a *better* design than the live tables — which makes them tempting to keep extending.
- Extending an unused schema alongside a used one is how three Interfaces screens shipped broken. **Decide, then migrate. Do not maintain both.**

## 4. 🟠 Rebuilding GoHighLevel inside the app — **STOP**
GHL works. It holds 1,642 contacts and kept lead flow alive through the entire outage. The app has begun duplicating it:
- `outreach_touches` (**0 rows**, RLS-blocked) — GHL already does outreach.
- `comm_channels`, `agent_conversations` (0) — GHL already does conversations.
- `exec_va_tasks` SMS queue (17,806) — GHL already does campaigns.
> **Never duplicate:** contacts, campaigns, nurture sequences, appointment reminders.

## 5. 🟠 `generate_va_tasks()` — **STOP the generator**
17,806 rows, **+614 in two days**, zero consumers. It is manufacturing a backlog that makes real queue depth unreadable. Turn it off until something drains it.

## 6. 🟠 New AI agents — **STOP**
The SMS/voice agent is fully built — personas, state machine, compliance gates, 8 test files — and has processed **0 conversations**. The counselor layer: 6 tables, 0 rows. Agent evaluations: 0.
**There is no shortage of AI capability here. There is a shortage of it being switched on.** Build no new agents until one runs.

## 7. 🟠 More route groups — **STOP**
Twelve route groups for one business. `(investor)`, `(partner)`, `(vendor)`, `(program)` collectively serve tables with **0 rows** — ~30 of 105 routes (29%) render against tables that have never held a record.

## 8. 🟡 Dispatch / rescue — **STOP** (already dormant)
5 routes, Leaflet maps, RLS, smoke tests. `incidents` = 0 since May. A complete, competent, unused subsystem. Archive it rather than maintaining it.

## 9. 🟡 More documentation — **STOP**
**362 markdown files** — comparable to the entire source tree. `ARCHITECTURE.md` and `DATABASE-SCHEMA.md` are three months stale and predate 173 applied migrations. More documents will not fix documents that nobody re-verifies.

---

## The pattern
> **This project's failure mode is not bad code. It is building the next thing before the last thing has a user.**

Nearly every item above is *well-engineered* — tested, RLS'd, compliance-aware. That is what makes it dangerous: the quality makes it feel like progress. Twenty-nine percent of the UI serves empty tables while the one route that brings in money has been returning 500 for two weeks.

**One rule for the next 90 days: nothing new ships until something existing has a paying user.**
