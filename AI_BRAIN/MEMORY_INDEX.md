# Memory Index

Use this file as the master map of important business knowledge.

## Business

- Company overview:
- Core services:
- Current business priorities:
- Key constraints:

## Fleet

- Active vehicles:
- Maintenance rules: Use `FLEET/MAINTENANCE_TRACKER.md` and generated maintenance reminder reports. Do not rent vehicles with unresolved high-urgency safety, damage, failed inspection, or out-of-service alerts.
- Inspection requirements: Log inspection actions in `FLEET/INSPECTION_LOG.md`; unresolved action needed or damage should trigger review before next rental.
- Utilization targets:

## Finance

- Revenue streams:
- Expense categories:
- Payment rules:
- Margin targets:

## Customers

- Ideal customer profile:
- Active customers:
- Lead sources:
- Follow-up standards: Use `CUSTOMERS/MESSAGE_TEMPLATE_LIBRARY.md` for approved car rental messages. Routine messages can be delegated or automated. Damage, disputes, complaints, and extension decisions escalate to owner.

## Vendors

- Maintenance vendors:
- Insurance contacts:
- Software/tools:
- Other suppliers:

## SOPs

- Critical SOPs: Car rental communication SOP.
- SOPs to create:
- SOPs needing review:

## Legal

- Contract templates:
- Insurance requirements:
- Compliance items:
- Risk notes:

## Automation

- Active automations:
- Automation ideas: Daily command center generation, maintenance reminders, customer follow-up reminders, weekly operations report, local business memory index, booking confirmation, pick-up reminders, return reminders, review requests.
- Systems connected: Local workspace files. External/cloud systems require explicit approval.
- Local tools in use: Markdown trackers. Recommended stack: Ollama, Open WebUI or AnythingLLM, n8n, Python, SQLite, ChromaDB, Docker.
- Architecture blueprint: `AUTOMATIONS/LOCAL_AI_ASSISTANT_ARCHITECTURE.md`
- Workflow engine / app memory: `AI_BRAIN/TMMT_WORKFLOW_ENGINE_CLAUDE_MEMORY.md`

## AI Agents

| Agent | File | Role | Partner |
|---|---|---|---|
| Captain America | `AI_BRAIN/PROMPTS/CAPTAIN_AMERICA.md` | Accountability — daily shield check, pattern detection, scoring | Wonder Woman |
| Wonder Woman | `AI_BRAIN/PROMPTS/WONDER_WOMAN.md` | Execution — message drafts, tasks, SOPs, follow-up sequences | Captain America |

**How to activate:** Copy the full contents of the agent file and paste as the system prompt in Claude or Codex.

**The loop:** Cap reads the daily brief → flags overdue items → Wonder Woman drafts the actions → Muhammad approves → Cap logs it done.

## Projects

- Active projects:
- Waiting on:
- Completed:
