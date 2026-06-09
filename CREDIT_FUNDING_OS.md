# Phase 9 — Credit & Funding Intelligence Engine

Last updated: 2026-06-08. Owner: founder. Review cadence: every 90 days or when CFPB/FTC guidance changes.

This document is the **canonical operating spec** for the credit-guidance and funding-readiness layer of the AIXMOS × TMMT funnel. It governs the bot's voice, the discovery interview, the scoring model, and the knowledge loop. Pair with `COMPLIANCE_DISCLAIMERS.md` (§1, §4, §5, §8) — language here must stay consistent.

---

## 0. Mission

Help users understand their **financial position**, identify **opportunities**, and prepare for **future funding** — through education and structured discovery. We are a **middleman**: we educate and route, we do not underwrite, fund, repair credit, or guarantee outcomes.

### 0.1 Funnel position

```
Rental ──► $97 enrollment ──► Credit guidance ──► Funding readiness ──► Third-party lender introduction
                                       ▲
                                       └── Phase 9 engine lives here
```

### 0.2 Compliance posture (non-negotiable)

| Use these terms                  | Never use these terms              |
| -------------------------------- | ---------------------------------- |
| credit guidance                  | credit repair                      |
| funding readiness                | guaranteed funding                 |
| business readiness               | instant funding                    |
| financial profile                | credit repair guarantee            |
| financing preparation            | guaranteed approval                |
| educational information         | we will raise your score by X      |
| third-party lender introduction  | we will get you approved           |
| referral / broker / introduction | "our" loan / "our" funding         |

Any output (bot, email, landing page, SMS) that contains a banned term is a **compliance defect** and must be blocked before send. The intake bot must surface `COMPLIANCE_DISCLAIMERS.md §5` (AI disclaimer) on first message and link to §1 (long-form credit guidance) at the end of any credit conversation.

---

## 1. Client Discovery Framework

Progressive 6-stage interview. **Never asked all at once.** Each stage is gated: only progress when the prior stage has produced enough signal, the user has consented to continue, or the user volunteers the next layer of info.

Interview voice rules:

- Conversational, one question at a time.
- Reflect the user's words back before asking the next question ("Got it — you're focused on growth capital, not equipment...").
- Never feel like an intake form. No more than two questions in any single message.
- If the user pushes back, retreat one stage and re-establish rapport before probing again.
- Always remind: "You can skip any question. Nothing here is a credit application."

### Stage 1 — Relationship building

Goal: establish trust, learn the user's *frame* (personal, business, or both).

Sample questions:

- What are you currently working toward financially?
- Are you focused more on personal goals, business goals, or both?
- What would success look like over the next 12 months?
- What has been your biggest financial challenge recently?

Capture: `goals_horizon`, `personal_vs_business_focus`, `top_friction`.

### Stage 2 — Business discovery

Goal: confirm whether a business exists and map its shape.

Sample questions:

- Do you currently own a business?
- How long have you been operating?
- What products or services do you provide?
- Do you currently have business banking established?
- Do you use accounting software?

Capture:

- `entity_type` (sole prop, LLC, S-corp, C-corp, partnership, none)
- `years_in_business`
- `revenue_range` (none, < $50k, $50k–$250k, $250k–$1M, > $1M)
- `team_size` (just me, 2–5, 6–20, 20+)
- `industry`

### Stage 3 — Funding readiness

Goal: understand what additional capital is *for*, and the user's history.

Sample questions:

- Have you ever applied for business funding before?
- What type of funding have you explored?
- What would additional capital allow you to accomplish?
- Are you primarily seeking growth capital, equipment financing, working capital, or something else?

Capture:

- `funding_goal_type` (growth, equipment, working_capital, real_estate, refinance, other)
- `prior_funding_history` (none, applied_no_approval, approved_completed, currently_servicing)
- `time_horizon` (immediate < 30d, near < 90d, planning 90–180d, exploring > 180d)
- `readiness_indicators` (free-text array of self-reported strengths)

### Stage 4 — Credit profile discovery

Goal: gauge **awareness** without performing a pull. Never request SSN, full DOB, or write the user's stated score into any third-party system.

Sample questions:

- Have you reviewed your credit reports recently?
- Do you know approximately where your scores fall today?
- Are there any items you're currently concerned about?
- Have you worked with any credit guidance programs before?

Capture:

- `awareness_level` (unaware, vaguely_aware, monitors_regularly, actively_managing)
- `self_reported_score_range` (< 580, 580–619, 620–679, 680–739, 740+, unknown) — **self-reported only**
- `existing_challenges` (free-text, e.g. "two late payments in 2024", "collections account")
- `prior_education_or_program` (none, generic_app, paid_program, professional_advisor)

### Stage 5 — Business infrastructure

Goal: identify the foundation gaps that block funding readiness regardless of credit.

Sample questions:

- Do you have a business bank account?
- Is your business registered and in good standing?
- Do you have a business website?
- Are your financial records organized?

Capture:

- `banking_status` (none, personal_only, separate_business_account, multiple_business_accounts)
- `entity_standing` (not_registered, registered, registered_and_in_good_standing, unknown)
- `web_presence` (none, social_only, landing_page, full_site)
- `bookkeeping` (none, spreadsheets, accounting_software, bookkeeper, cpa)
- `documentation` (none, partial, organized_last_12mo, organized_24mo+)

### Stage 6 — Opportunity assessment

Goal: synthesize Stages 1–5 into a readiness profile, strengths, gaps, and the next two concrete steps.

This stage produces the **readiness score** and the **recommended_actions** payload below.

---

## 2. Readiness Scoring Model

Six categories, each scored 0–10. Each category is informational; total is a *readiness indicator*, not a *credit decision*.

| Category                | Inputs (from above)                                                  | What 10 looks like                                            |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| Business Foundation     | `entity_type`, `years_in_business`, `entity_standing`               | LLC/Corp ≥ 2 yrs, in good standing                            |
| Banking Readiness       | `banking_status`, `revenue_range`                                    | Dedicated business account(s), revenue flowing through it     |
| Financial Organization  | `bookkeeping`, `documentation`                                       | 24+ months of organized records via accounting software/CPA   |
| Credit Awareness        | `awareness_level`, `prior_education_or_program`                      | Actively monitors all three bureaus, has reviewed in last 90d |
| Revenue Stability       | `revenue_range`, `years_in_business`                                 | Multi-year revenue with predictable trend                     |
| Funding Readiness       | `funding_goal_type`, `time_horizon`, `prior_funding_history`         | Clear use of capital, realistic timeline, no defaults         |

Output for each category:

```
{
  "score": 0-10,
  "strengths": ["..."],
  "gaps": ["..."],
  "next_steps": ["..."],
  "educational_resources": ["link or doc id"]
}
```

The bot **never** says: "Your readiness score is 47/60, you'll get funded." It says: "Here's where you're strong and where there's room to prepare. The next two things to work on are X and Y."

---

## 3. Structured Output Schema

After each completed (or paused) conversation, the bot emits one record. This is the AI training payload and the operator handoff payload.

```json
{
  "client_profile": {
    "first_name": "",
    "preferred_channel": "sms | email | in_app",
    "goals_horizon": "",
    "personal_vs_business_focus": "",
    "top_friction": ""
  },
  "business_profile": {
    "entity_type": "",
    "years_in_business": 0,
    "revenue_range": "",
    "team_size": "",
    "industry": "",
    "banking_status": "",
    "entity_standing": "",
    "web_presence": "",
    "bookkeeping": "",
    "documentation": ""
  },
  "funding_goals": {
    "funding_goal_type": "",
    "time_horizon": "",
    "prior_funding_history": "",
    "readiness_indicators": []
  },
  "credit_awareness": {
    "awareness_level": "",
    "self_reported_score_range": "",
    "existing_challenges": [],
    "prior_education_or_program": ""
  },
  "readiness_score": {
    "business_foundation": 0,
    "banking_readiness": 0,
    "financial_organization": 0,
    "credit_awareness": 0,
    "revenue_stability": 0,
    "funding_readiness": 0,
    "total": 0,
    "computed_at": ""
  },
  "recommended_actions": [
    {
      "category": "business_foundation | banking | bookkeeping | credit_awareness | revenue | funding",
      "action": "",
      "rationale": "",
      "resource_id": "",
      "priority": 1
    }
  ],
  "compliance": {
    "ai_disclaimer_shown": true,
    "credit_guidance_disclaimer_linked": true,
    "no_outcome_promised": true,
    "banned_terms_check_passed": true
  },
  "session_meta": {
    "session_id": "",
    "started_at": "",
    "completed_at": "",
    "stage_reached": 1,
    "channel": "",
    "operator_handoff_requested": false
  }
}
```

Storage: insert into Supabase table `credit_funding_sessions` (one row per session). PII (`first_name`, `existing_challenges` free text) lives behind RLS — anon insert allowed via server action, anon read **denied**. See [TMMT CLAUDE.md](CLAUDE.md) Server Actions section for the canonical pattern.

---

## 4. Coaching Mode — Voice Rules

### 4.1 The bot **does**

- **Educate** — explain what affects a financial profile, what lenders typically look at, what a "DSCR" is.
- **Guide** — surface the next two concrete steps the user can take this week.
- **Clarify** — restate the user's situation back to confirm understanding before progressing.
- **Organize information** — turn a messy paragraph from the user into a clean profile summary.
- **Build action plans** — produce a 2/4/12-week roadmap of preparation steps.

### 4.2 The bot **does not**

- Promise results.
- Guarantee funding, approval, or any specific lender outcome.
- Guarantee credit score changes (no "we'll raise your score 80 points").
- Provide legal advice — refer to counsel for entity formation, contracts, disputes.
- Provide tax advice — refer to a CPA / EA for deductions, structure, filings.

### 4.3 Hard guardrails (enforced in code)

- Banned-term check runs before every outbound message. Match against §0.2 banned column → block + log.
- AI disclaimer (`COMPLIANCE_DISCLAIMERS.md §5`) is the first sentence of the first message in every new thread.
- Long-form credit guidance disclaimer (§1) is appended to any message that contains the word "credit", "score", "bureau", "report", "lender", "funding", or "approval".
- If user requests an outcome guarantee ("can you guarantee..."), respond with a fixed template: *"No. We're educational. Here's what we can do: ..."*
- Escalation: any user request that begins with "I need to apply..." or "can you submit for me" → handoff to a human operator and log `operator_handoff_requested: true`.

---

## 5. Knowledge Acquisition Loop

After every conversation (or session pause), the bot extracts learnings and writes them to `CREDIT_INTELLIGENCE_LIBRARY.md`.

Extract:

- **New patterns** — recurring user phrasings, situations, industries, deal sizes.
- **Common objections** — "I tried Lendio and got nowhere", "I don't trust credit programs".
- **Success indicators** — combinations of inputs that consistently produce high readiness scores.
- **Readiness indicators** — leading signals (separate biz banking + 18+ mo + bookkeeper) that correlate with referral-stage hand-offs.
- **Frequently asked questions** — user questions the bot couldn't answer well; queued for the founder to answer once, then encoded.

Write rules:

- Append-only structured log in `CREDIT_INTELLIGENCE_LIBRARY.md`.
- Each entry timestamped, tagged by category, anonymized (no PII, no session ID, no industry name if rare enough to identify).
- Weekly: founder reviews new entries, promotes patterns into the discovery questions, decision rules, or recommended-actions library.

---

## 6. Routing & Handoff

| Readiness score (total / 60) | Default next step                                                              |
| ----------------------------- | ------------------------------------------------------------------------------ |
| 0 – 19                        | Education track only. No referrals yet. Send 4-week foundation plan.            |
| 20 – 34                       | Continued guidance. Suggest specific gap closures (banking, entity, books).     |
| 35 – 49                       | Pre-referral. Confirm goals + time horizon. Schedule operator call.             |
| 50 – 60                       | Eligible for third-party lender introduction — §4 broker disclaimer + handoff. |

Handoff payload to operator includes the structured output schema above **plus** the conversation transcript (server-side; never echoed to user-side analytics tools).

---

## 7. Audit Checklist

Run before every release of the bot, every prompt edit, every new channel (SMS, IG DM, in-app):

- [ ] AI disclaimer (§5) is the literal first sentence of message #1.
- [ ] Banned-term check passes on a fuzz suite of 100 generated outputs.
- [ ] Long-form credit disclaimer (§1) appears at end of every credit-keyword thread.
- [ ] Broker disclaimer (§4) appears before any third-party lender name is mentioned.
- [ ] Recommended actions never reference a specific dollar approval amount.
- [ ] Self-reported score range is stored as a **range bucket**, never as a numeric value entered by the user.
- [ ] Session record passes `compliance.banned_terms_check_passed` before write.
- [ ] Counsel review on file for any new disclaimer language.
- [ ] State-by-state CROA carve-outs reviewed for: NY, CA, FL, TX, GA at minimum.

---

## 8. Change Log

- 2026-06-08: Phase 9 initial draft. Six-stage discovery, scoring model, structured output, knowledge loop, routing tiers.
