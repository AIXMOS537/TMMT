# Financial Priority Ledger — lead by example

> **Order:** Allah (God) first → your wellbeing → family → others  
> **Method:** Committee/BC discipline + entity-separated books + one master bill register

---

## The leaderboard (always in this order)

| Rank | Bucket | What it means in practice |
|------|--------|---------------------------|
| 1 | **God** | Zakat/sadaqa planned, halal income, no riba shortcuts, honest books |
| 2 | **Self / wellbeing** | Sleep, health, legal credit repair for *you*, tools that keep you sharp — not vanity spend |
| 3 | **Family** | Mother, sisters, father, aunt — utilities, remittance, future house fund |
| 4 | **Others** | Moe Legacy client work, operators, community — **after** home is stable |

Money that comes quick can leave quick. **Priorities locked first** = you can teach Moe Legacy and operators from a real example, not theory.

---

## Committee / BC → this project

Your mother and father used **committee** (BC): trusted circle, fixed contributions, rotating payout, everyone accountable.

Mapped to AIXMOS/TMMT:

| Committee idea | System equivalent |
|----------------|-------------------|
| Fixed monthly contribution | $97/mo operator seat, GHL subscription, token allotment |
| One person takes the pot this cycle | Rotating family savings goal (CSV row: `Decision=Committee cycle`) |
| Trust + show up | Mesh access gated by payment + owner seal |
| Don't spend what isn't yours | Entity-separated bank accounts + token meter |

---

## Entity map (never mix)

```
Personal checking     → rent, food, personal cards, Claude Max
Family bucket         → mother/sisters/house fund (separate savings account ideal)
TMMT business         → fleet, rentals, insurance, fleet expenses
All In One / AIXMOS   → GHL agency, Vercel, platform, your software revenue
Moe Legacy (client)   → Umar lane — consulting fee OR separate client account
```

**Moe Legacy is not your business** — you build it as contractor. His credit-guidance revenue stays fenced.

---

## Cost cuts (verified stack — do these)

From `docs/COST-AND-CAPACITY.md`:

| Action | Savings | Effort |
|--------|---------|--------|
| **Retire Airtable** after Supabase is source of truth | ~$20–45/mo | Low |
| **Anthropic API monthly cap** (app AI only) | Prevents surprise | 5 min |
| **Vercel spend ceiling + alerts** | Prevents surprise | 5 min |
| **ClickUp seats** — only staff who use ClickUp | ~$7–12/seat/mo | Medium |
| **One Claude Max seat** — Cursor + Claude Code, don't duplicate | ~$100+/mo | Now |
| **GHL** — confirm you're not on a tier above what you use | Variable | 15 min |
| **Duplicate Vercel projects** — already retired `tmmt-c919` | Done | — |

Realistic burn today: **~$12–20/day** (~90% flat subscriptions). Operators don't move the AI meter.

---

## Weekly rhythm (15 minutes)

```bash
bash scripts/tmmt finance sweep    # subscriptions + due-soon bills
bash scripts/tmmt homeloop         # mesh + work readiness
```

1. Update `imports/finance/master-bills.csv` — mark paid, adjust amounts  
2. Check **Due in 7 days** from sweep output  
3. One cut or one negotiation per week (cancel, downgrade, or defer)  
4. Teach one person one principle (committee, entity split, or token cap)

---

## Teaching others (Moe Legacy / operators)

Script you can say:

> "We run separate accounts like my parents ran committee — everyone knows what bucket they're in. Platform money doesn't touch personal. API and AI have a meter so fast money doesn't become fast debt. God and family get planned first; business tools come after."

---

## Related

- `imports/finance/master-bills.csv` — master register  
- `docs/COST-AND-CAPACITY.md` — technical stack costs  
- `docs/runbooks/ACTIVATE-GHL-MONEY-COLLECTION.md` — business bank firewall  
- `scripts/claude-finance.sh` — Claude Code handoff for finance automation
