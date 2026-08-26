# Automation Backlog

| Automation | Problem Solved | Tool | Priority | Status | Notes |
|---|---|---|---|---|---|
| Daily command center generation | Keeps priorities visible | Local script / cron | High | Active MVP | Script: `AUTOMATIONS/SCRIPTS/daily_command_center.py` |
| Maintenance reminders | Reduces missed service | Calendar / local script | High | Active MVP | Script: `AUTOMATIONS/SCRIPTS/maintenance_reminders.py` |
| Customer follow-up reminders | Improves conversion and retention | CRM tracker / local script | High | Active MVP | Script: `AUTOMATIONS/SCRIPTS/customer_followup_reminders.py` |
| Multi-channel command router | Lets owner send commands from Telegram, Slack, WhatsApp, iMessage, or GHL and route tasks automatically | n8n / GoHighLevel / ClickUp / Supabase | High | MVP Next | See `EXECUTION/COMMAND_ROUTER.md` |
| Telegram owner command bot | Fastest way to capture and delegate owner commands | Telegram / n8n / ClickUp | High | Planned | Build first to prove command flow |
| Slack credit command channel | Lets credit team receive tasks, lead alerts, and approval requests | Slack / n8n / ClickUp / GHL | High | Planned | Credit business priority |
| GoHighLevel command intake | Routes CRM and customer conversation actions into the command agent | GHL webhooks / n8n | High | Planned | Main CRM integration |
| Supabase command log | Creates source-of-truth history for every command and action | Supabase | High | Planned | Required before scaling automations |
| ClickUp task assignment | Creates tasks with assignees, due dates, and priorities | ClickUp / n8n | High | Planned | Main execution output |
| Weekly operations report | Improves visibility | Spreadsheet / script | Medium | Idea |  |
| Local business memory index | Makes SOPs, fleet notes, CRM, and finance records searchable | ChromaDB / Python | High | Proposed | See `LOCAL_AI_ASSISTANT_ARCHITECTURE.md` |
| Local assistant interface | Gives one private place to ask business questions | Ollama / Open WebUI or AnythingLLM | High | Proposed | Local-first default |
| Automation logging | Creates accountability and troubleshooting trail | Python / n8n | High | Proposed | Store logs in `AUTOMATIONS/LOGS` |
| Booking confirmation message | Sends confirmation without manual typing | OpenPhone / Turo saved replies / n8n | High | Proposed | Template in `CUSTOMERS/MESSAGE_TEMPLATE_LIBRARY.md` |
| Pick-up reminder message | Reduces missed or late pick-ups | OpenPhone scheduled text / n8n | High | Proposed | 24 hours before pick-up |
| Day-of pick-up message | Confirms timing and reduces confusion | OpenPhone scheduled text / n8n | Medium | Proposed | Send by 8:00 AM |
| Return reminder message | Reduces late returns and extension surprises | OpenPhone scheduled text / n8n | High | Proposed | 24 hours before return |
| Review request message | Increases repeat bookings and reviews | OpenPhone / email automation / n8n | Medium | Proposed | Within 1 hour of completed return |

## Priority Rules

- High: Saves time weekly, reduces financial risk, or prevents operational failure.
- Medium: Improves reporting, consistency, or customer experience.
- Low: Nice-to-have convenience.
