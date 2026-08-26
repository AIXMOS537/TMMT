# Command Center ops records — archived May 2026

Business and operations records lifted out of the retired `tmmt-command-center`
deployment. **Reference material, not live documentation.** Nothing here is wired
to the running app; treat every figure as a May 2026 snapshot.

## Where these came from

`tmmt-command-center` deployed from a lineage with **no common ancestor with
`master`** — a separate ~100-commit history running 2026-03-25 to 2026-05-18. The
complete tree is preserved at tag `archive/command-center-2026-05-18` (`0cfcadd`).

These 55 files are the reusable business records from that tree: automations and
their prompts, GHL integration blueprints, SOPs, fleet and customer process
templates, finance and legal indexes, and the original command-center
architecture plan and spec. App code was deliberately left behind — see
`docs/COMMAND-CENTER-CARRYOVER.md` for the full triage and why the
`/v/[venture]` routes were superseded rather than ported.

## 11 files were withheld for customer PII

Excluded under the L10 rule — customer financials and identities stay out of
tracked documentation:

| file | why |
|---|---|
| `OPERATIONS/DAILY_BRIEF_2026-05-16.md` | names + phones + weekly payment amounts + overdue flags |
| `OPERATIONS/DAILY_BRIEF_2026-05-17.md` | named customers tied to fleet and collections tasks |
| `OPERATIONS/TODAY_COLLECTIONS.md` | named customers with amounts owed and days past due |
| `OPERATIONS/COMMAND_CENTER.md` | named customers across money and fleet priorities |
| `CUSTOMERS/LEAD_FOLLOWUPS_THIS_WEEK.md` | named leads with phone numbers |
| `CUSTOMERS/RENTAL_GHL_PIPELINE.md` | customer name in a pipeline example |
| `FLEET/MAINTENANCE_WEEK_SCHEDULE.md` | customer names against service records |
| `INTEGRATIONS/GHL_AGENCY_SETUP_TODAY.md` | customer name in setup notes |
| `AUTOMATIONS/WEBHOOKS/ghl_contact_map.example.json` | real names inside an "example" fixture |
| `AI_BRAIN/PROMPTS/CAPTAIN_AMERICA.md` | real customer names baked into prompt text |
| `AI_BRAIN/PROMPTS/WONDER_WOMAN.md` | same |

All remain recoverable from the tag when there is a legitimate business reason:

    git show archive/command-center-2026-05-18:OPERATIONS/TODAY_COLLECTIONS.md

**Do not copy them into tracked documentation.**

## A note on how these were found

Regex scanning for phone numbers and money missed most of them — real names sat
mid-line, inside AI prompts, and inside a file labelled `.example.json`. What
worked was building a name list from the files caught first, then sweeping every
file for those names. If you ever lift more from this tag, do the same: grep for
known customer names, don't trust format-based patterns alone.

Everything kept here was verified clean of names, phone numbers, emails and
credentials before commit. The only remaining `$` figures are generic command
examples and GHL plan pricing.
