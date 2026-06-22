# Operator Brain — terminology & access map

**Read this first** when you join the AIXMOS / TMMT mesh. Plain language. No guru fluff.

---

## The journey (Learn → Earn → Operate)

| Stage | What you do | What the system does |
|-------|-------------|----------------------|
| **Learn** | Free training — how credit, rental, and ops actually work | Training modules + portal playbook |
| **Build** | Follow your written plan; weekly check-in | Tracks progress; drafts support messages (you approve sends) |
| **Qualify** | Work toward lender approval | Pipeline + docs — **we help you qualify, never guarantee** |
| **Keys** | Step into a vehicle the right way | TMMT rental path when eligible |
| **Operate** | Run your lane as a TMMT operator | Your portal, your org, your data only |

---

## Words you'll hear

| Term | Meaning |
|------|---------|
| **AIXMOS** | The friendly face — training, portal, operator assistant. What you see. |
| **TMMT** | The rental / ops vertical (vehicles, fleet, dispatch). |
| **HailMary / Project X** | Owner command brain. **You never get this.** |
| **Rung** | Your access level (0–5). Higher = more live features. Owner advances you. |
| **Booyah** | Owner-only command that moves an operator one rung. Not yours to run. |
| **Portal token** | Scoped read key for *your* live data only. Revocable anytime. |
| **Riley** | Sales agent module (when your rung includes it). |
| **Motherbox** | Flash-deploy kit that stands up your machine fast. |
| **Fatherbox** | Owner mesh (Tailscale + support). You join with consent. |
| **Draft-don't-blast** | Nothing mass-sends without review. 1/customer/day default. |

---

## Booyah ladder (what unlocks at each rung)

| Rung | Name | You get |
|------|------|---------|
| **0** | Portal | Static playbook + checklist. No live CRM data. |
| **1** | Live | Scoped live KPIs (referrals, etc.) via portal token |
| **2** | Intake | Write intake / lead capture into *your* org |
| **3** | Agent | Riley sales agent (SMS/voice per license) |
| **4** | Store | E-commerce storefront module |
| **5** | Full Brain | Own spec + full operator OS (earned, not sold as hype) |

**You never get:** full repo, Cyborg, kill-switch, other operators' data, `ADMIN_KEY`, service keys.

---

## Three walls (how you're kept safe — and how others are kept safe from you)

1. **Code** — your own repo / portal copy. Not the owner's stack.
2. **Data** — every row filtered to your `organization_id`. Server-side.
3. **Power** — license modules. Owner can widen (`booyah`) or revoke (`revoke`) instantly.

---

## Your bookmarks (day one)

1. **Login** — https://tmmt-command-center.vercel.app/login → `/operator`
2. **What you sell** — https://tmmt-ops.vercel.app/kits · https://tmmt-ops.vercel.app/build
3. **Lead intake** — https://tmmt-ops.vercel.app/forms/lead-intake

---

## Compliance (non-negotiable)

Say **credit guidance, coach, guide, plan**.  
Never **credit repair, fix your credit, guarantee, 100%, delete negative items**.

We help you qualify. We do not promise outcomes.

---

## When you're stuck

1. Check your portal checklist (Rung 0) or live dashboard (Rung 1+).
2. Post in your operator channel (owner assigns).
3. Book office hours — not a $15K ghost call.

**Never paste passwords or API tokens into chat.** Use Dashlane / owner-issued portal tokens only.

---

## Owner docs (not for operators)

`docs/PROJECT-X-HAILMARY.md` · `docs/BUILD_MEMORY.md` · `docs/SECURITY-TAHA.md`

---

## Agent helper

When using Cursor / Claude / AIXMOS assistant, load **`docs/OPERATOR-AGENT-RULES.md`** — that's your AI operating manual (distilled from production agent architecture, not a leaked prompt).
