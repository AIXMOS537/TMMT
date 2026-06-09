# Credit Intelligence Library

Last updated: 2026-06-08. Owner: founder. Cadence: append after every session; founder review weekly.

Append-only log of patterns, objections, success signals, readiness indicators, and FAQs extracted by the Phase 9 bot (see `CREDIT_FUNDING_OS.md` §5). Anonymized — no PII, no session IDs, no identifying industry detail.

This file is **read on bot boot** to influence:

1. Which discovery questions get prioritized.
2. Which objections get pre-empted in the script.
3. Which gap-closure resources are surfaced first.

---

## How to write an entry

```
### YYYY-MM-DD — <short title>
**Category:** pattern | objection | success_indicator | readiness_indicator | faq
**Frequency:** seen N times | first observation
**Stage observed:** 1–6
**Signal:**
<one paragraph, no PII>

**Action taken (if any):**
- prompt update / new resource / new discovery question / queued for founder
```

Promote a pattern only after it appears **3+ times** or once with strong founder review.

---

## 1. Patterns

> Recurring user phrasings, situations, deal shapes. Track to refine the script.

(empty — seed entries land here)

---

## 2. Common Objections

> What users push back with. Track to pre-empt or to retreat gracefully.

(empty — seed entries land here)

---

## 3. Success Indicators

> Combinations of inputs that consistently produce high readiness scores or successful operator handoffs.

(empty — seed entries land here)

---

## 4. Readiness Indicators

> Leading signals that correlate with the user being ready for a third-party introduction.

(empty — seed entries land here)

---

## 5. Frequently Asked Questions

> Questions the bot couldn't answer well. Queue → founder answers once → encode into the bot.

(empty — seed entries land here)

---

## 6. Promoted to Bot

> Entries that have moved from observation here into the live bot prompt, discovery script, or resource library. Source of truth for what was learned and shipped.

(empty — promotions logged here with date and target file)

---

## Change Log

- 2026-06-08: Initial library skeleton. Six-section structure aligned to `CREDIT_FUNDING_OS.md §5`.
