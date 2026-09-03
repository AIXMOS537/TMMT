# 32 · AI-FIRST OPERATIONS STRATEGY

**Premise:** this system already has more AI capability than it uses — a full SMS/voice agent with compliance gates that has never held a conversation, and a task generator producing 17,806 unconsumed rows. The strategy is therefore **not "add AI"** but **"switch on the safest existing piece, with a human on the trigger."**

## Automation opportunity matrix
| Manual task | Today | Human effort | Data available | Feasibility | Risk | Human approval | Pri |
|---|---|---|---|---|---|---|---|
| Lead capture → CRM | broken | — | ✅ | trivial | low | none | **1 (fix, not AI)** |
| **Reactivating the 81 + 104** | not happening | high | ✅ full history | **high** | med (TCPA) | **required — draft only** | **2** |
| Missing-document chase | manual | high | ✅ | high | low | none | 3 |
| Background-check triage (69 stuck) | manual | med | ✅ | high | **med — decisioning** | **required** | 4 |
| Lead qualification/scoring | partial | med | ✅ 876 leads | high | low | none | 5 |
| Daily ops summary | ✅ working | — | ✅ | done | low | none | ✅ |
| Payment/arrears reminders | none | high | 🔴 free-text money | **blocked** | med | required | 6 *(after money fix)* |
| Data cleanup (759 leads no status) | none | high | ✅ | high | low | spot-check | 7 |
| Review requests | none | low | ✅ | high | low | none | 8 |
| CRM field hygiene | manual | med | ✅ | high | low | none | 9 |
| Expense categorisation | agent exists | low | ✅ 34 rows | high | low | none | 10 |
| Maintenance reminders | none | low | ⚪ 4 rows | med | low | none | later |
| Inspection photo analysis | none | — | 🔴 no photos | **blocked** | med | required | later |
| Contract generation | none | ⚪ | ⚪ | med | **high — legal** | **required** | later |
| Dispute letters | built | — | ⚪ | built | **high — regulated** | **legal gate** | **hold** |

## Safe to automate now (no approval)
Data cleanup and enrichment · lead scoring · CRM hygiene · daily summaries (already live) · expense categorisation · exception detection (stuck-stage alerts) · review requests.
**Common property:** read-heavy, reversible, no outbound contact.

## Automate with approval (draft-never-send)
Reactivation outreach to the 81/104 · document chase · background-check triage recommendations · payment reminders.
**The infrastructure for this already exists and is good:** banned phrases, quiet hours, area-code timezone, opt-out, DNC failing closed, PII redaction — all tested. **The gate is policy, not capability.**

## Keep human
Approval/denial decisions · pricing and discounts · anything touching money movement · dispute filing · contract execution · complaint handling.

## Not appropriate for AI
Legal/regulatory judgement · credit-repair advice · insurance determinations · collections escalation past first reminder.

## Recommendations
1. **Turn off `generate_va_tasks()`** until a consumer exists. 17,806 rows with no drain is not automation, it is accumulation.
2. **Pick one agent and run it end-to-end.** The safest is document-chase or review-request: low risk, real value, exercises the whole path (Twilio → compliance gates → audit) with a human approving each send.
3. **Do not build new agents.** Run the one that exists.
4. **Fix money before automating billing** — free-text amounts make every financial agent impossible.

> The compliance layer here is better than most companies have when they *start* sending. That work is done. What is missing is a decision to send one message.
