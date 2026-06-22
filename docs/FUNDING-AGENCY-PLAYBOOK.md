# 💰 Funding Agency Playbook — the process, automated in-house

> The end-to-end process a credit-guidance + business-funding agency runs to get
> clients funded — mapped to your existing AIXMOS system so **AI agents do the
> repetitive work and humans (not overseas labor) only touch what matters.**
> Open anytime: **`agency`** (or `funding`). Companions:
> `docs/MOE-LEGACY-PORTAL.md`, `docs/MOE-LEGACY-CLOSING-KIT.md`,
> `docs/MARKETING-ADS-KIT.md`, `docs/LEARN-EARN-CHURN.md`.

## The client journey (the process you're copying — it's a standard model)
```
  LEAD → QUALIFY → GUIDANCE → READINESS → FUNDING PLACEMENT → FUNDED → RETAIN
```
None of this is proprietary — it's how funding agencies operate. You compete by
running it **faster, cleaner, and mostly automated.**

| Stage | What happens | Automated by (in-house) | Human needed? |
|---|---|---|---|
| **1 Lead** | ads + outbound bring people in | `ads` kit + GHL forms + outbound engine | no |
| **2 Qualify** | capture + score (credit band, income, biz age) | `/forms/credit-funding-intake` → `/learn` readiness score | no |
| **3 Guidance** | review credit, optimization steps (utilization, mix, errors) | `/learn` plan + agent coaching + doc checklist | light (review) |
| **4 Readiness** | get the profile fundable | `/learn` tracks score/steps; agent nudges | light |
| **5 Placement** | submit to lenders / Fund&Grow / Credit Suite | doc package + agent-prepped applications | **yes (you/closer)** |
| **6 Funded** | approvals come back; collect success fee | invoice (`deal`) + GHL | light |
| **7 Retain** | next vertical, referrals, affiliate | `member` ladder + affiliate | no |

**The model: agents run 1–4 and 7; humans focus on 5 (placement) + closing.**

## 🤖 Replace overseas labor with agents (what runs itself)
- **Outbound + replies** — agent sends the opt-in compliant first-touch, answers
  FAQs, books calls (GHL + the agent layer). No VA needed.
- **Intake + qualification** — the form + readiness score do it; agent summarizes.
- **Document collection** — automated checklist + reminders (`/learn/documents`,
  `document-storage`). Agent chases missing docs.
- **Follow-up + nudges** — agent works the sequence; `moe-hot` ranks who's hot.
- **Status updates** — agent texts the client their progress automatically.
- **Humans only for:** lender placement strategy, the close, and compliance review.
  That's 1–2 sharp people, not a room of overseas VAs.

## 💵 The funding products (what you actually get them)
- **0% business credit** (stacked cards) — via Fund&Grow / Credit Suite style.
- **Business lines of credit / term loans** — lender submissions.
- **Personal funding** where appropriate.
- You're the **guidance + placement layer** — you get them ready and submit.

## 📣 Marketing + outbound engine (compliant — read this)
- **Inbound (best):** `ads` kit → free readiness check → opt-in form = **consent**.
  This is the clean fuel; scale it.
- **Outbound — the legal line (TCPA/CAN-SPAM, do NOT skip):**
  - **No cold mass texting/calling consumers without prior express consent** — that's
    how agencies get sued into the ground. 
  - **Compliant outbound:** people who opted in (your ads/forms), your existing
    contacts, or B2B business outreach with proper identification + opt-out.
  - Every message: identify yourself, **honor STOP instantly**, **8am–9pm local**,
    AI persona disclosed first. Email: CAN-SPAM (real address + unsubscribe).
- **Warm > cold, always.** The ads kit's free taste turns strangers into consented
  leads — that's your outbound list, built legally.

## ⚖️ Compliance backbone (this is what keeps the agency alive)
- **CROA (federal):** for credit work — **no advance fees** for "repair," and you
  say **"guidance," never "repair."** Charge for **guidance service + funding
  success/placement**, structured by counsel. 
- **FCRA:** lawful handling of credit data; client authorization before pulls.
- **State CSO/lending laws:** some states regulate credit-services orgs — check yours.
- **TCPA:** consent before automated outbound (above).
- **Get the structure blessed once by counsel** (`docs/deal-kit/`) — then it scales.

## ▶️ Stand it up (your one-word ops)
1. `ads` → run inbound to the free readiness check (consented leads)
2. `moe-hot` → agents + you work the hottest first
3. `playbook` → close them onto guidance + funding
4. `deal "Name" <amount>` → paperwork + invoice
5. `ceo` / `watchtower` → run the whole thing daily
6. `new-operator` → clone the agency to more operators across AZ

## Build phases (to full auto)
- **P1** — inbound ads + free taste live (consented lead flow).
- **P2** — agent works intake/follow-up/docs/status (overseas labor → agents).
- **P3** — placement playbook (lenders/Fund&Grow) + success-fee invoicing.
- **P4** — counsel blesses fees/compliance once → scale + clone to operators.

---

_Same process the agencies run — just faster, in-house, agent-powered, and
compliant. Inbound fuel + agent ops + a sharp human on placement = a funding
machine you own. Open anytime: `agency`._
