# M1 WORK LAW — Muhammad Taha

**Status:** Permanent law. Non-negotiable. Read by every agent on Carry and M1.

**Config:** `config/m1-work-law.json`  
**Router:** `scripts/mesh/m1-work-router.sh`  
**Drop work:** `tmmt work "your task"` or `bash scripts/m1-door.sh send "task"`

---

## The law (one paragraph)

When Muhammad Taha receives, creates, or is tasked with work — across **any business venture**, **personal life**, **social life**, or **professional life** — the system **tracks it**, **scores it**, and **routes it**. **All new work goes to M1 (Rick/forge) by default.** M1 executes locally, reports back, and only escalates to Carry when a **sovereign owner gate** applies. Triage order: **emergency → money → people helped (long-term vision) → time → energy → cost**. The goal is always: **how many people can we help** without breaking Taha or the family.

---

## Sovereign vs operational

| Layer | Device | Role |
|-------|--------|------|
| **Sovereign** | Carry M5 (Watchtower) | Keys, vault, deploy, legal, money moves, family private, LIVE sends |
| **Operational** | M1 Max (Rick/forge) | Receive work, triage, build, draft, test, queue — **zero human after BLIP** |

M1 is Muhammad Taha **operationally**, not **sovereignly**. Private never crosses the wall.

---

## Domains (all tracked)

1. **Business** — TMMT, AIXMOS, HAILMARY, GHL, operators, revenue, ship
2. **Personal** — health, family admin, home, faith, rest, protection
3. **Social** — friends, community, events, relationships
4. **Work** — meetings, follow-ups, team, clients, vendors

Drop files into:

```
~/Brain/vault/00-Dashboard/OWNER-WORK-INTAKE/
  business/
  personal/
  social/
  work/
```

Or use: `tmmt work "task description" --domain business`

---

## Triage dimensions

Every work item gets scored **1–5** on each dimension (defaults apply if omitted):

| Dimension | Weight | Question |
|-----------|--------|----------|
| **Emergency** | 1000 | If ignored today, does something break, burn, or hurt? |
| **Money** | 100 | Unlocks cash, stops bleed, protects revenue? |
| **People helped** | 50 | Second chances, income, dignity, time back — **long-term vision** |
| **Time** | 30 | Real deadline or decay window? |
| **Energy** | 20 | Can M1 absorb without draining Taha? (5 = fully on M1) |
| **Cost** | 10 | Free/local execution? (5 = zero paid tokens) |

**Composite score** = weighted sum. Higher runs first in `FLEET-INBOX`.

**Owner attention** (score ≥ 850 with owner_gate): stays on Carry — Taha approves.  
**M1 executes** (score ≥ 100, no owner_gate): Syncthing → `~/Sync/rick/FLEET-INBOX/` → Rick picks up.

---

## Intake sources (automatic)

The router scans on every tick (Carry + M1):

- `OWNER-WORK-INTAKE/**/*.md`
- `IDEA-QUEUE-LIVE.md` (OPEN P0 rows)
- `HANDOFF-TO-FORGE/*.md`
- `watchtower-inbox/*.md`
- `dominoes-*.md` (after Taha types GO on Carry)

Ledger: `~/.config/tmmt/.owner-only/work-ledger.tsv`

---

## Owner gates (Carry only — never M1)

- Deploy to production
- Legal / contracts / signing
- Money moves / checkout / billing changes
- Family private / HR / termination
- Master keys / vault / `hc god`
- **LIVE sends** (email, SMS, post) — M1 stages drafts only

---

## Commands

```bash
# Drop work (Carry or anywhere)
tmmt work "Fix GHL checkout URLs" --domain business --emergency 5 --money 5

# Route all intake now
bash scripts/mesh/m1-work-router.sh route

# Status + ledger tail
bash scripts/mesh/m1-work-router.sh status

# Send one mission manually
bash scripts/m1-door.sh send "Build operator onboarding draft"

# Release domino cascade (human gate first)
bash scripts/dominoes
```

On M1 after BLIP: autopilot runs router + fleet executor every tick — **no human required**.

---

## North star

> Peaceful. Paid. Protected. Maximize how many people we help — family first, then operators, then the public — without burning Muhammad Taha.

Serve the owner first. Then serve the network. Put respect on the name.
