# TMMT/AIXMOS Customer Support Runbook

Owner: founder. On-call: Justin (lead) → Dominique (backup) → Michael (escalation) → Dashan (compliance) → founder.

Goal: Justin/Dominique field 80% of tickets without escalating. Escalation is for **money, legal, or safety** — not for "I don't know".

---

## Service Level Targets (100-user scale)

| Channel | First reply | Resolution target |
|---|---|---|
| In-app chat / Slack `#sales` | 15 min business hours | same day |
| Email (`hello@`, `support@`) | 2 hours business hours | next business day |
| SMS | 15 min business hours | same day |
| Phone voicemail | 1 hour | same day callback |
| After-hours (8pm-8am ET) | next morning | next business day |

**Business hours: M-F 9am-7pm ET, Sat 10am-4pm ET, Sun closed.**

## Triage decision tree

For every inbound, ask in this order:

1. **Safety?** (vehicle accident, injury, breakdown on road, customer in distress) → call founder immediately, then dispatch per emergency protocol. Do not delay for any reason.
2. **Money in motion?** (charge dispute, refund ask, double-charge, missing payment, lender call) → escalate to Michael with all transaction IDs in same message. Don't promise anything to the customer beyond "we're verifying — we'll respond by EOD."
3. **Legal threat / compliance?** ("I'm calling my lawyer", "this violates CROA", "I'm reporting you to CFPB/AG", "I'll dispute on my credit report") → escalate to Dashan + founder. Acknowledge in writing within 1 hour: "We hear you, we're reviewing, [name] will respond personally." Never argue, never apologize for the product, never admit fault in writing.
4. **Service question?** → Justin/Dominique resolve from this runbook.

## Common tickets — canned responses

**Source of truth:** all canned responses live in GHL → Snippets, named `TKT-001` through `TKT-XXX`. Update there, not in copies.

| Code | Trigger | One-line response | Action |
|---|---|---|---|
| TKT-001 | "When does my $97 rental start?" | "Your slot opens [date] at [time]. Confirmation email is in your inbox; check spam if missing." | Pull from `incoming_leads` by phone/email |
| TKT-002 | "I want a refund" (within 7 days) | "Refunds within 7 days are automatic — processing now, 3-5 business days back to your card." | Refund in Stripe; mark `customer_payments.refunded=true` |
| TKT-003 | "I want a refund" (after 7 days) | "Past the 7-day window we review case-by-case. Sending to my team lead for review by EOD." | Escalate to Michael with payment ID + reason |
| TKT-004 | "My credit didn't go up" | "Credit movement depends on the bureau cycle (30-45 days), payment history, and other factors outside our program. Want to schedule a 15-min review of your report with our education team?" | Send Calendly link. Do NOT promise score increase. |
| TKT-005 | "The car broke down" | "Sorry — getting you help now. Where are you and is everyone safe?" | Then dispatch roadside per fleet ops |
| TKT-006 | "I lost my key/wallet/phone" | "Walk me through what happened — I'll get you back on the road." | Document in ticket; if key, fleet ops handles replacement charge |
| TKT-007 | "I can't log in" | "Try the magic-link option on the login page — check spam if it doesn't arrive in 2 min. If it still fails, send me the email you registered with." | Verify in Supabase `auth.users` |
| TKT-008 | "Is this a credit repair company?" | "We provide **education** about credit. We're not a credit repair organization and we don't dispute items on your behalf. See our compliance page: [domain]/legal/credit." | Send §1 short disclaimer from COMPLIANCE_DISCLAIMERS.md |
| TKT-009 | "Where is my funding?" | "Funding decisions are made by the third-party lender, not us. I'll pull your file and follow up by EOD with what they've told us." | Escalate to Michael — funding partner contact |
| TKT-010 | "I want to cancel" | "Understood. Confirming what would cancel today: [list]. Reply CONFIRM to cancel or talk to us first if there's something we can fix." | Wait for CONFIRM. Then offboard per checklist. |

## Who handles what

| Topic | Primary | Backup |
|---|---|---|
| $97 rental questions | Justin | Dominique |
| New lead intake | Dominique | Justin |
| Fleet / mechanical | Michael | founder |
| Background checks | Dashan | Michael |
| Credit education | Dashan | founder |
| Funding partner follow-ups | Michael | founder |
| Refunds & disputes | Michael | founder |
| Legal / compliance | Dashan + founder | — |
| Press / partnerships | founder | — |

## Tooling

- **Ticket system:** ClickUp list `[INSERT_LIST_ID_HERE]` — every inbound becomes a task. Tag: `ticket`, priority by triage.
- **Customer record:** Airtable + Supabase `public.tickets` (current row count: 308). Cross-link by `incoming_leads.id`.
- **Outbound voice/SMS:** GHL. Use Snippets for canned text — never paste raw.
- **Internal escalation:** Slack `#sales` for routine, `#ops` for ops issues, DM founder for safety/legal.
- **Funding partner status:** check `deals` and `deal_payments` tables in Supabase.

## Daily ops

- **9:00am ET** Justin opens ClickUp, reviews overnight tickets, posts AM standup in `#sales`: "OPEN: N | NEW: N | BLOCKED: N".
- **12:30pm ET** Mid-day sweep — anyone uncovered > 2h gets a "we're on it" reply.
- **5:30pm ET** EOD post in `#sales`: "CLOSED TODAY: N | CARRYING OVER: N | NEEDS FOUNDER: N".
- **Friday 4:00pm ET** Posted automatically by the [Friday Recap routine](../.claude/memory/project_routine_morning_brief.md) — review and act on flagged items by Monday 10am.

## Escalation language (use verbatim)

When something needs to leave Justin/Dominique:

> "I want to make sure we get this right — I'm looping in [Michael / Dashan / founder] who handles [topic]. They'll be in touch within [SLA window]. Thanks for your patience."

This buys time without committing to anything. Always state the SLA window. Always follow through.

## What NEVER goes in writing to a customer

- Promised credit score increases
- "We can fix your credit"
- "Guaranteed funding"
- Apologies that admit specific fault ("Yes, we charged you wrong" — instead: "We're verifying and will respond by EOD")
- Any rate, fee, or term that's not already on the signed contract
- Anything about another customer (even initials)

## Weekly review (Sunday 6pm ET — founder)

Pull the week's tickets:
1. % resolved without escalation (target: 80%)
2. Avg first-reply time by channel
3. Top 3 reasons people contacted (drives product backlog)
4. Any TKT codes that came up 5+ times — make sure the canned response is actually helping

Update this runbook when reality diverges from documentation.

---
Last updated: 2026-06-03. Next review: 2026-07-03.
