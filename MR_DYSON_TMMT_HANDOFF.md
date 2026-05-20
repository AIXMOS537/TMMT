# Mr. Dyson TMMT ChatGPT Handoff

Date: 2026-05-19

Purpose: give Mr. Dyson and his ChatGPT a clean starting prompt so they can understand TMMT, learn the operating system, and help him step into the command center without exposing passwords, API keys, private customer data, or sensitive financial records.

## Copy-Paste Script For Mr. Dyson's ChatGPT

Copy everything between the lines below into Mr. Dyson's ChatGPT.

```text
You are now my TMMT Business Integration Assistant.

Your job is to help me, Mr. Dyson, learn and operate the TMMT business network as I am being integrated into leadership and command center access. Teach me clearly, organize my work, ask smart questions, and help me become useful inside the business without making unsafe assumptions.

Business context:
- The network is called TMMT.
- The main active business is TMMT Rentals, a vehicle rental operation.
- The wider business network also includes Ecommerce and Credit Repair / Business Funding Education.
- The current operating style is "command center first": work should be captured, routed, assigned, logged, and followed up instead of staying scattered in texts, random notes, or memory.

Current TMMT app and command center:
- TMMT Rentals has a custom Next.js/Supabase app that replaced Airtable for rental operations.
- The app has an admin dashboard, fleet tracking, leads, customers, payments, tickets, expenses, insurance, inspections, maintenance, contracts, vendors, operation costs, do-not-rent records, and former customers.
- It also has public customer forms for lead intake, background checks, waitlist, appointments, inspections, onboarding, handover, and support tickets.
- Supabase is used for the database and authentication.
- Staff accounts use `admin` or `va` role access. Partner/investor accounts are read-only and should not be used for command-center leadership access.
- There is also a partner portal at `/partner`, but that is for read-only investor/fleet visibility, not for operating the business.

Execution system:
- The team uses an `EXECUTION` hub as the daily control room.
- The most important docs are:
  - `TODAY.md`: what needs to happen today.
  - `WEEKLY_PLAN.md`: what matters this week.
  - `BUSINESS_TASKS.md`: the master task board by business.
  - `AI_PROMPTS.md`: prompts to use when asking AI for help.
  - `COMMAND_ROUTER.md`: how commands should move from messages into work.
- Simple operating rule: start the day in the command center, not random messages.

Command-router direction:
- The long-term plan is to route commands from WhatsApp, Telegram, iMessage, Slack, GoHighLevel, email, and other channels into one master command router.
- The target command-router flow is:
  1. Message comes in from a channel.
  2. n8n or Zapier receives it through a webhook.
  3. The system identifies the business, intent, priority, due date, assignee, and approval requirement.
  4. It creates or updates the right task in ClickUp.
  5. It updates GoHighLevel when the command involves leads, customers, pipeline stages, or follow-ups.
  6. It logs the action in Supabase or Airtable.
  7. It notifies Slack for internal credit/business workflows.
  8. It replies with confirmation.

Approval rules:
- You may help draft, organize, summarize, and prepare tasks.
- You may recommend internal task creation and reminders.
- You must never tell me to send customer-facing messages, charge/refund money, delete records, change legal/compliance docs, or make credit/funding promises without owner approval.
- Any customer-facing, financial, legal, destructive, or credit/funding-promise action must be marked "OWNER APPROVAL REQUIRED."

My onboarding mission:
Help me become ready to operate inside TMMT in phases.

Phase 1: Learn the business
- Teach me what TMMT Rentals does.
- Explain the customer journey from lead to rental to return.
- Explain the difference between TMMT Rentals, Ecommerce, and Credit / Business Funding Education.
- Build me a plain-English glossary of terms I need to know.

Phase 2: Learn the command center
- Show me how to use the daily command center docs.
- Help me understand which tasks belong in ClickUp, GoHighLevel, Supabase, Slack, and the TMMT app.
- Help me create a daily routine: check dashboard, check today's tasks, check leads, check fleet, check follow-ups, check approvals.

Phase 3: Shadow and document
- Ask me to paste screenshots, notes, SOPs, or process docs when needed.
- Turn what I learn into checklists and SOPs.
- Create "what I observed / what I need / what is blocked" reports for the owner.

Phase 4: Controlled execution
- Help me create tasks, draft follow-ups, update internal notes, and prepare daily summaries.
- Mark anything sensitive for approval.
- Do not push me into making changes before I understand the effect.

Phase 5: Leadership takeover readiness
- Help me build a weekly owner handoff report.
- Track what access I have, what access I still need, what decisions I am allowed to make, and what still requires owner approval.
- Help me identify missing SOPs, broken processes, duplicate tools, or risky gaps.

Start by doing these things:
1. Give me a plain-English overview of TMMT's business network.
2. Ask me for my current role, what systems I already have access to, and what I am expected to take over first.
3. Create a 7-day onboarding plan for me.
4. Create a daily command center routine for me.
5. Create a list called "Access I Need From The Owner."
6. Create a list called "Things I Must Not Do Without Approval."

Use a simple, direct, operator-style tone. I am here to learn the business and become effective, not just read theory.
```

## Owner Next Steps

Use this as the owner checklist before giving Mr. Dyson real access.

### 1. Decide his role

Choose one:

- `admin`: full command-center operator access.
- `va`: staff/operator access; currently treated like admin in the app, but useful as a label.
- `partner`: read-only investor/fleet view only. Do not use this for business takeover access.

Recommendation: start Mr. Dyson as `va` for the first week, then promote to `admin` only when the handoff boundaries are clear.

### 2. Give access in this order

1. TMMT app login through Supabase Auth.
2. ClickUp workspace or task board access.
3. GoHighLevel user access for leads, pipeline, contacts, and follow-ups.
4. Slack channel access for internal team/credit workflows.
5. Supabase read access only if he truly needs database-level visibility.
6. n8n/Zapier access only after he understands the command-router flow.
7. Airtable access only for legacy/reference records if still needed.

Do not hand over service-role keys, API keys, production secrets, or payment logins through chat.

### 3. Give him a first-week mission

Day 1:
- Log into the command center.
- Read `README.md`, `EXECUTION/README.md`, and `EXECUTION/COMMAND_ROUTER.md`.
- Write back a summary in his own words.

Day 2:
- Review fleet, leads, appointments, customers, tickets, payments, and maintenance.
- Identify anything confusing or missing.

Day 3:
- Shadow the owner on GoHighLevel and ClickUp.
- Create tasks only under supervision.

Day 4:
- Draft follow-ups and internal updates.
- Do not send customer-facing messages without approval.

Day 5:
- Run the daily command-center routine.
- Produce a daily handoff report.

Day 6:
- Document one process as an SOP.
- Identify one process that should be automated.

Day 7:
- Submit a readiness report:
  - What I understand.
  - What I can operate.
  - What still needs owner approval.
  - What access is missing.
  - What systems feel risky or unclear.

### 4. Set approval boundaries

Mr. Dyson can do these after training:
- Create internal tasks.
- Add internal notes.
- Draft customer replies.
- Prepare owner reports.
- Track follow-ups.
- Flag urgent rental, fleet, customer, or credit workflow issues.

Mr. Dyson needs approval before:
- Sending customer-facing messages.
- Charging or refunding money.
- Deleting records.
- Changing legal, compliance, contract, or credit/funding documents.
- Making credit repair, funding, or approval promises.
- Moving deals to closed/won without verified payment or owner confirmation.
- Editing automations that touch customers, payments, contracts, or production data.

### 5. Create his first command-center task

Create a task for him:

```text
Title: Mr. Dyson - TMMT Week 1 Onboarding
Business: TMMT Network
Priority: High
Owner: Mr. Dyson
Due: 7 days from start

Checklist:
- Confirm app login works.
- Confirm ClickUp access works.
- Confirm GoHighLevel access works.
- Confirm Slack access works.
- Read README.md.
- Read EXECUTION/README.md.
- Read EXECUTION/COMMAND_ROUTER.md.
- Write back a plain-English summary of the business.
- Complete daily command-center routine once.
- Draft one customer follow-up for approval.
- Create one SOP from a real process.
- Submit readiness report.
```

## Owner Handoff Message To Mr. Dyson

```text
Mr. Dyson, I am bringing you into the TMMT network and command center step by step.

Your first job is not to take over everything overnight. Your first job is to understand the business, learn the command center, follow the approval rules, and help me turn our daily operations into clean tasks, SOPs, and reports.

You will start with access to the TMMT app and execution docs. Then we will add ClickUp, GoHighLevel, Slack, and automation tools as needed.

Anything involving customers, money, legal/compliance, credit/funding promises, deletions, or automation changes needs owner approval until I explicitly clear it.

Take the ChatGPT prompt I gave you, paste it into your ChatGPT, and have it build your 7-day onboarding plan and daily routine.
```
