# TMMT / AIXMOS — Master Project Context

**Version 1.1** · 2026-09-01 · Owner: Muhammad Taha, TMMT Auto Services LLC

This folder is the complete context package for the TMMT / AIXMOS operational
platform. Point Claude Code at this folder at the start of any session on this project.
It replaces every earlier prose brief.

---

## Read in this order

| # | File | What it is |
|---|------|-----------|
| — | **`CLAUDE.md`** | Rules of engagement. Auto-loaded by Claude Code. **Read every session.** |
| 01 | `01-BUSINESS-BLUEPRINT.md` | The business model of record: ecosystem, actors, journeys, lifecycles, status model, dashboards, workflows, automation categories, integrations, compliance |
| 02 | `02-CURRENT-STATE-AUDIT.md` | What is **actually deployed** as of 2026-09-01, with gaps, conflicts, and risks |
| 03 | `03-DATA-MODEL.md` | Canonical entities and how they map onto tables that already exist |
| 04 | `04-ROADMAP.md` | Phased plan, brownfield-aware |
| 05 | `05-OPEN-DECISIONS.md` | Business decisions still needed. Never invent answers to these |
| 06 | `06-MVP-SPEC.md` | The first shippable version, scoped against what already exists |

---

## The three things that govern everything

**1. This is not a car-rental website.** It is an operational ecosystem managing
relationships between people, vehicles, rentals, owners/investors, partners, and
multiple customer pathways.

**2. "Not qualified for rental" is a business state, not the end of the relationship.**
The pipeline for people who don't qualify today is a first-class part of this system.

**3. Build around relationships and lifecycle events, not around "customers."** A
person may be a renter, then a progression client, then an owner, then an investor.
The system asks *what relationships does this person hold and what pathway are they
on* — never *what type of customer is this*.

---

## The one operational warning

**This is a brownfield project.** A large system already exists and holds live customer
data — roughly 170 Supabase tables, 30 Airtable tables, 875 leads, 43 vehicles, 35
customers, 1,642 CRM contacts. Roughly 70% of the vision is already built in some form.

> **Default posture: reconcile, extend, and harden what exists. Do not re-implement.**
> Check `02-CURRENT-STATE-AUDIT.md` before building anything. If something genuinely
> must be rebuilt, raise a change request (`CLAUDE.md` §4) and get approval first.

---

## The sequence we are following

```
BUSINESS REQUIREMENTS   ← 01, 05 (this folder)
        ↓
WORKFLOWS               ← 01 §8
        ↓
DATA MODEL              ← 03
        ↓
USER ROLES / PERMISSIONS← 05 §6 (open)
        ↓
SYSTEM ARCHITECTURE
        ↓
INTEGRATIONS            ← 05 §5 (open)
        ↓
UI / UX
        ↓
IMPLEMENTATION          ← 04, 06
        ↓
TESTING
        ↓
DEPLOYMENT
```

The point of that order is to avoid the expensive mistake: building technically
impressive software around business rules that were never actually defined.

**Where we are:** business requirements, workflows, and data model are drafted. Roles,
permissions, and integrations are blocked on the decisions in `05`.

---

## The next document to produce

A formal **Business Requirements & Workflow Specification** — the level below this
blueprint, written per workflow rather than per concept. It should contain, for each
of the workflows in `01-BUSINESS-BLUEPRINT.md` §8:

business actor · trigger · step-by-step sequence · information collected at each step ·
system actions · **human approval points** · notifications sent · exit conditions ·
error and exception paths · the business rules applied (each labeled `[STATED]`,
`[RECOMMENDED]`, or `[OPEN]`).

That specification, plus the decisions in `05`, is what makes the technical
architecture safe to commit to.

---

## Labeling convention — used throughout

| Label | Meaning |
|---|---|
| `[STATED]` | The owner explicitly said this. Treat as policy. |
| `[RECOMMENDED]` | A professional recommendation, not yet approved. |
| `[OPEN]` | Requires a business decision. Do not guess. |

Values already sitting in the production database are **not** automatically `[STATED]`.
Several were seeded during a build and have never been confirmed. See
`02-CURRENT-STATE-AUDIT.md` §5.
