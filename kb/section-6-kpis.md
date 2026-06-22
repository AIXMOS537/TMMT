# Section 6 — KPIs (importable copy)

> Canonical source: `OPERATIONS_BRAIN.md §6`
> This file is the importable repo copy for agents and automations.
> If the canonical source changes, update this file to match.
> Escalation thresholds (breach conditions) are defined in `AIXMOS_OPERATING_LAYER.md §4.3`.

---

## The Only Numbers That Matter

| KPI | Definition | Target | Owner |
|-----|-----------|--------|-------|
| Fleet utilization | (Cars rented today / Cars available) × 100 | ≥ 70% daily | Dyson + Dominique |
| Cars rented per week | Count of new rental starts | Set by CEO | Bibbs + Dyson |
| AIXMOS sales per week | $97 sales closed | Set by CEO | Sumaima + Areesha |
| Past-due A/R | Total $ owed past due date | Decrease weekly | Wania |
| Lead response time | Time from lead in → first text/call | < 5 min | Rida (TMMT) / Sumaima (AIXMOS) |
| Lead-to-close % | (Closed deals / Leads in) × 100 | Track + improve | Bibbs (TMMT) / Sumaima (AIXMOS) |
| Renewal rate | % of customers who renew | ≥ 60% | Areesha |
| Content-to-lead | Leads tagged "social / video" | Set monthly | Javeria |

---

## Daily Huddle Format (5 questions, same order every day)

Run by Dominique at 8:30 AM. Attendees: Dominique, Dyson, Bibbs, Justin (by phone). CEO optional.

1. 💵 **Money in yesterday?** TMMT $X / AIXMOS $X
2. 🚗 **Cars out today?** Out / Available / Down
3. 📞 **Leads in yesterday → calls booked → closes?**
4. 🚧 **Top blocker today?**
5. 🎯 **One commitment from each person.**

Write the 5 numbers on a whiteboard. No strategy debate.

---

## Weekly Stoplight Report (Friday 3 PM)

| Metric | This Week | Last Week | Status |
|--------|-----------|-----------|--------|
| TMMT cash collected | | | 🟢🟡🔴 |
| AIXMOS cash collected | | | 🟢🟡🔴 |
| Fleet utilization % | | | 🟢🟡🔴 |
| AIXMOS sales closed | | | 🟢🟡🔴 |
| Cars rented this week | | | 🟢🟡🔴 |
| Past-due A/R | | | 🟢🟡🔴 |
| Leads in | | | 🟢🟡🔴 |
| Lead-to-close % | | | 🟢🟡🔴 |

Three questions after the table:
1. What worked this week?
2. What didn't?
3. What changes next week?

---

## Escalation Thresholds

See `AIXMOS_OPERATING_LAYER.md §4.3` for the full escalation matrix (breach conditions → alert targets).

Quick reference:
- Lead response > 15 min → alert Justin/Dominique
- Fleet utilization < 50% → alert Dominique + CEO
- Single past-due item > $200 → Wania + Dominique
- AIXMOS sales < 50% of target at week 2 → Justin + CEO
- Renewal rate < 40% trailing month → Areesha + Justin
- Any banned word in agent output → HALT + owner-approval gate
