# Onboarding an operator

The console is the fast part. Everything else is accounts.

---

## 1. Give them a console (about 4 seconds)

```bash
node tools/add-operator.js "Sara Ahmed"
```

That adds her to `tools/profiles.json`, rebuilds every console, and prints the
file to hand over: `TeamDashboards/Dashboard-Sara-Ahmed.html`.

Other roles:

```bash
node tools/add-operator.js "Dev Patel" dispatch
node tools/add-operator.js "Ana Cruz" operator --subtitle "TMMT · Mobile detail"
```

Roles, most access to least: `owner`, `manager`, `dispatch`, `operator`,
`sales`, then `family` / `friend` / `vendor` (personal links only).
An operator sees Briefing, Dispatch, Cases, Calendar and the Assistant —
no billing, no infrastructure, no keys.

**Someone starting today, before you've settled their details?** Hand them
`TeamDashboards/_onboarding/Dashboard-New-Operator.html`. It is a working,
generic operator console, rebuilt on every run so it is never stale. Add them to
the roster properly when you know their name.

The file is self-contained — email it, drop it on their desktop, or copy it to a
USB stick. Nothing else travels with it, and it adapts to whatever machine they
open it on.

---

## 2. Give them access (the part that actually matters)

A console is a page of links. **It grants nothing.** Every system behind it has
its own account, and that is where access really lives.

| System | What to do | Where |
| --- | --- | --- |
| **Supabase** | Create their profile row and set the role | TMMT users → project `uapxakmlwnpfsftfeezx` |
| **GoHighLevel** | Add a user, but only if they touch the pipeline | TMMT Rentals location |
| **Slack** | Invite to the workspace and the crew channel | app.slack.com |
| **ClickUp** | Add to the board they'll actually work | app.clickup.com |
| **OpenPhone** | Only if they take customer calls | my.openphone.com |

Give an operator the minimum: Supabase profile, Slack, and a ClickUp seat. Add
GoHighLevel and OpenPhone only when the job needs them.

---

## 3. Show them the console once

Ninety seconds, in person, on their own machine:

- **Tiles** — everything they can reach. What they see is what their role allows.
- **Mic** — tap it, say a tile name: "dispatch", "calendar", "cases".
  Hands-free, then "Nexus …", runs it without touching anything.
  Voice needs Edge or Chrome and asks for the microphone once.
- **Ctrl+K** — the command palette. Works everywhere, no microphone needed.
  This is the one to teach if their browser or their hands are busy.
- Unknown words come back with the list of verbs. It won't dump them into a
  web search — `search <thing>` is a separate, deliberate verb.
- If the machine feels slow, the **graphics** chip under the mic cycles
  `auto → lite → standard → full`. It already picked a setting from their
  hardware; the override is there for when it guessed generously.

---

## 4. Off-boarding

Removing someone from `tools/profiles.json` stops producing their console.
**It does not revoke anything** — they may still have the file, and the accounts
in section 2 are still live.

So, in order:

1. Revoke Supabase, GoHighLevel, Slack, ClickUp, OpenPhone.
2. Remove them from `tools/profiles.json`.
3. Move their console into `TeamDashboards/_removed/`.
4. `node tools/build-consoles.js`

Retired consoles are kept in `_removed/` rather than deleted, so a returning
person can be restored by putting them back on the roster and rebuilding.
The previous operator crew is parked there now — see
`TeamDashboards/_removed/RETIRED.md`.
