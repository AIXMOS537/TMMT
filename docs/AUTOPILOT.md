# 🎮 AUTOPILOT — the machine that runs without you

> You are the orchestrator, not the operator. This file is so you (and any agent)
> never forget the autopilot exists. It runs in the cloud on its own schedule —
> **not** tied to any chat window. Close every tab. It keeps going.

## What's running right now (cloud Routines — zero input needed)

| Routine | Fires | What it does for you |
|---|---|---|
| **AIXMOS Autonomous Operator Loop** | **twice daily — ~8am & ~8pm ET** | The worker. Reads the repo, advances the build, fixes small CI breaks, opens PRs, merges its own clean green ones. The repo is its memory, so nothing is lost between runs. Pings you **only** for a decision that's legally/financially yours. |
| **Morning Brief** | daily ~9am ET | Overnight activity, what needs you (P1/P2/P3), secret-scan, team pulse. |
| **Funnel & Copy Auditor** | Tue/Thu ~10am ET | Tears down one sales surface, rewrites it compliance-clean. Read-only. |
| **Friday Recap** | Fri ~4pm ET | Week in review + posts a TL;DR to Slack. |

Notifications: **push + email** on the worker loop. If your phone is quiet, the machine is healthy.

## The rule that protects you (never remove)

The autopilot will **never** send a message, move money, sign, ship, deploy, or
unlock a legal flag (credit/funding/dispatch) on its own. Those stop at the
**owner-approval gate** (`.claude/hooks/` + `shared/owner-approval-gate/`) and wait
for you. That's not a limitation — it's the thing that keeps you out of CROA / FTC
trouble while the rest runs hands-free.

## How to control it (just say the word — to any Claude session)

You never touch a dashboard. Tell an agent, in plain English:

- **"Pause the autopilot"** → disables the worker loop.
- **"Turn the autopilot back on"** → re-enables it.
- **"Make the autopilot more/less aggressive"** → changes how often it fires.
- **"What's my autopilot doing?"** → lists every Routine + when it last/next fires.
- **"Run the autopilot now"** → fires it on demand instead of waiting.

Under the hood these map to the Routine tools (`list_triggers`, `update_trigger`,
`fire_trigger`, `delete_trigger`). You don't need to know that. Just talk.

## Worker loop ID

`trig_01DUENsd1B1ws6ASotHUPTaL` · cron `0 0,12 * * *` · env `env_01So97S6mevJsxjeVmPN9JK7`

---

**Bottom line:** the machine never sleeps, and forgetting a chat can't kill it.
The work speaks. — For the people. By the people.
