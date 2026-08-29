# Local AI Assistant Architecture

## Objective

Build a local-first AI operating system that can search business records, maintain operational memory, generate reports, trigger reminders, draft documents, and automate repeatable workflows without depending on cloud services by default.

The expanded operating model also supports a cloud-connected command agent for the user's active business stack: GoHighLevel, Supabase, Airtable, n8n, Zapier, ClickUp, Slack, WhatsApp, Telegram, iMessage, and related integrations.

## Architecture Principles

1. Local-first storage and processing.
2. Human approval for financial, legal, customer-facing, and destructive actions.
3. Simple files first, databases when scale requires it.
4. Every automation must have a clear owner, log, failure state, and manual fallback.
5. Privacy by default: no cloud sync or external API unless explicitly enabled.

## Recommended Local Stack

| Layer | Recommended Tool | Purpose | Priority |
|---|---|---|---|
| Local LLM runtime | Ollama | Run local models through a local API | High |
| Chat/workbench | Open WebUI or AnythingLLM | Business assistant interface | High |
| Automation engine | n8n self-hosted | Workflow automation and scheduled jobs | High |
| Lightweight scripts | Python | File parsing, reports, reminders, data cleanup | High |
| Structured database | SQLite first, PostgreSQL later | Track fleet, customers, finance, tasks | Medium |
| Vector memory | ChromaDB | Search SOPs, records, notes, and documents | Medium |
| Workflow builder | Flowise or Langflow | Visual agent workflows and prototypes | Low |
| Container runtime | Docker | Isolate services and simplify startup | Medium |

## Cloud Integration Stack

| Layer | Recommended Tool | Purpose | Priority |
|---|---|---|---|
| CRM and messaging | GoHighLevel | Contacts, pipelines, campaigns, conversations | High |
| Task execution | ClickUp | Tasks, assignees, due dates, project boards | High |
| Main database | Supabase | Command log, normalized records, agent memory tables | High |
| Operator-friendly database | Airtable | Manual views, lightweight operations, quick edits | Medium |
| Automation router | n8n | Webhooks, branching, API calls, approval flows | High |
| Connector fallback | Zapier | Fast integrations when n8n setup is slower | Medium |
| Team communication | Slack | Credit repair/business funding team updates and approvals | High |
| Owner command channels | Telegram, WhatsApp, iMessage | Quick commands from phone or desktop | High |

## Model Strategy

| Use Case | Model Family | Notes |
|---|---|---|
| General operations assistant | Llama 3 / Qwen | Good balance of reasoning and business writing |
| Coding and automation | DeepSeek / Qwen Coder | Stronger for scripts, APIs, and workflow logic |
| Fast classification | Phi / Mistral small models | Useful for tagging, routing, summaries |
| Document drafting | Mistral / Llama 3 | SOPs, customer messages, summaries |

## Core Assistant Modules

### 0. Multi-Channel Command Router

Purpose: Receive owner/team commands from messaging apps, classify the command, route it to the correct business, create or assign tasks, update CRM/database records, and reply with confirmation.

Inputs:

- Telegram bot messages
- Slack commands and channel messages
- GoHighLevel webhooks
- WhatsApp messages through GHL or Twilio
- iMessage quick capture through Apple Shortcuts or a Mac relay
- Email/Zapier/n8n triggers

Outputs:

- ClickUp tasks
- GoHighLevel contacts, tasks, notes, opportunities
- Supabase command log records
- Airtable records or views
- Slack internal updates
- Approval requests before sensitive actions

Reference:

- `EXECUTION/COMMAND_ROUTER.md`
- `AUTOMATIONS/COMMAND_AGENT_IMPLEMENTATION_PLAN.md`
- `DATA/SCHEMAS/agent_task_schema.json`

### 1. Command Center Assistant

Purpose: Generate daily priorities, carry over incomplete tasks, flag bottlenecks, and summarize what needs attention.

Inputs:

- `OPERATIONS/COMMAND_CENTER.md`
- `FLEET/*.md`
- `FINANCE/*.md`
- `CUSTOMERS/*.md`
- `AUTOMATIONS/AUTOMATION_BACKLOG.md`

Outputs:

- Daily priority list
- Follow-up list
- Risk alerts
- End-of-day summary

### 2. Fleet Operations Assistant

Purpose: Track vehicles, maintenance, inspections, downtime, availability, and utilization.

Inputs:

- `FLEET/FLEET_REGISTER.md`
- `FLEET/MAINTENANCE_TRACKER.md`
- `FLEET/INSPECTION_LOG.md`

Outputs:

- Maintenance reminders
- Inspection status alerts
- Vehicle availability report
- Utilization report
- Damage/risk summary

### 3. Customer/CRM Assistant

Purpose: Track leads, customers, follow-ups, messages, and customer issues.

Inputs:

- `CUSTOMERS/CRM_TRACKER.md`
- Customer notes and message logs

Outputs:

- Follow-up reminders
- Draft customer messages
- Lead status updates
- Customer issue summaries

### 4. Finance Assistant

Purpose: Track income, expenses, payment status, and weekly financial performance.

Inputs:

- `FINANCE/FINANCE_TRACKER.md`
- Invoices, receipts, bank export files when available

Outputs:

- Weekly finance summary
- Unpaid balance list
- Expense category report
- Margin alerts

### 5. SOP Assistant

Purpose: Create, update, and search standard operating procedures.

Inputs:

- `SOPS/SOP_INDEX.md`
- SOP documents
- Operational notes

Outputs:

- Draft SOPs
- Checklist versions
- Training notes
- Process improvement recommendations

## Data Flow

1. Business files stay organized in the existing folder structure.
2. A local indexing script scans markdown, CSV, spreadsheet, PDF, and document files.
3. Structured records are stored in SQLite.
4. Searchable text chunks are stored in ChromaDB.
5. Local LLM reads retrieved context and produces task-specific output.
6. n8n or cron triggers scheduled workflows.
7. Every automation writes logs to `AUTOMATIONS/LOGS`.

## Proposed Folder Additions

```text
AUTOMATIONS/
  CONFIG/
  LOGS/
  SCRIPTS/
  WORKFLOWS/
  PROMPTS/
DATA/
  DATABASES/
  EXPORTS/
  IMPORTS/
  VECTOR_INDEX/
AI_BRAIN/
  PROMPTS/
  MEMORY/
```

## Priority Automations

| Automation | Trigger | Output | Risk Level | Approval Needed |
|---|---|---|---|---|
| Daily command center brief | Every morning | Daily priorities and risks | Low | No |
| Maintenance due alert | Daily | Vehicle service alerts | Medium | No |
| Customer follow-up list | Daily | Contacts due today | Medium | No |
| Weekly operations report | Weekly | Fleet, finance, CRM summary | Medium | Review before use |
| Draft customer messages | On demand | Message drafts | Medium | Yes before sending |
| Finance exception report | Weekly | Missing payments and unusual expenses | High | Review required |
| SOP draft generator | On demand | Draft SOP/checklist | Low | Review before active |

## Local Security Rules

- Do not send customer, financial, legal, or vehicle data to cloud tools unless explicitly approved.
- Keep raw source data in `DATA/IMPORTS` or the original department folder.
- Store generated logs in `AUTOMATIONS/LOGS`.
- Require manual approval before sending messages, deleting files, changing financial records, or modifying legal documents.
- Back up `AI_BRAIN`, `DATA`, `FLEET`, `FINANCE`, `CUSTOMERS`, `SOPS`, and `LEGAL` regularly.

## MVP Build Plan

### Phase 1: Local Operating Base

- Install or confirm Ollama.
- Choose initial local model.
- Create automation folders.
- Convert core trackers to machine-readable CSV or SQLite.
- Build daily command center script.

### Phase 2: Searchable Business Memory

- Add ChromaDB.
- Build document indexer.
- Index SOPs, fleet files, finance trackers, and CRM notes.
- Create prompt templates for operations, fleet, finance, and customer workflows.

### Phase 3: Scheduled Workflows

- Add n8n or cron jobs.
- Generate daily brief automatically.
- Generate weekly operations report automatically.
- Create maintenance and customer follow-up reminders.

### Phase 4: Dashboards and Decision Support

- Build fleet utilization dashboard.
- Build finance summary dashboard.
- Add exception alerts for overdue maintenance, unpaid balances, and idle vehicles.

## Immediate Build Order

1. Create automation support folders.
2. Add a local system configuration file.
3. Create prompt templates for each assistant module.
4. Create CSV versions of fleet, customer, and finance trackers.
5. Build the first script: daily command center generator.
6. Add scheduled execution only after manual script output is reliable.

## Risks

| Risk | Impact | Control |
|---|---|---|
| Inconsistent data entry | Bad reports and alerts | Use templates and required fields |
| Over-automation too early | Wrong actions happen faster | Start with drafts and alerts only |
| No backup process | Business memory loss | Add scheduled local backup |
| Weak data model | Hard to scale reporting | Move trackers into SQLite when volume grows |
| Cloud leakage | Privacy exposure | Local-only default and approval gates |

## Success Metrics

- Daily command center can be generated in under 60 seconds.
- Maintenance due items are visible before they become emergencies.
- Customer follow-ups are not missed.
- Weekly operations report is produced consistently.
- SOPs become searchable and reusable.
- Manual tracking work decreases each month.
