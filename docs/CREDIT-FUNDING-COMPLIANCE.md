# AI Credit-Repair & Funding Guidance — compliance-by-design

> Moe Legacy runs the **first AI credit-repair + business-funding guidance** company,
> powered by **TMMT OS + the AIXMOS agents/network**. This product is sellable to
> anyone — *only* if it's built compliance-first. This is the spec that makes it so.
>
> **Not legal advice.** Counsel must review before anyone is charged
> (`config/credit-compliance.json → pre_sale_gate`). The runtime guardrail is
> `scripts/compliance-check.mjs`.

---

## 1. Positioning — guidance & education, not promises

The product is **AI-guided education + workflow** that helps people understand and
improve their credit and funding readiness, and dispute **inaccurate** items
themselves. It is **not** a machine for guaranteed deletions, synthetic identities,
or advance-fee credit repair. That framing isn't just safer — it's the only version
that scales to "sell to anyone," including simple home use.

## 2. The legal landscape (the landmines)

| Law / rule | What it means for this product |
|---|---|
| **CROA** (federal) | No advance fees for credit repair; written contract; 3-day cancel; mandatory disclosures; **no false/guaranteed-result claims**. |
| **FTC Telemarketing Sales Rule** | Separate advance-fee ban for credit repair sold remotely. |
| **State CSO laws** | Many states require **registration + a surety bond** to offer credit services. Confirm per state. |
| **FCRA** | Disputes must concern genuinely inaccurate/unverifiable info — **no fabricated or frivolous disputes**. |
| **Funding side** | Lender/broker **licensing**; ECOA/UDAAP; and **securities law** the moment you offer equity/returns. |
| **GLBA / privacy** | Consumer PII (reports, SSNs) must be protected and access-controlled. |

_I'm not a lawyer; this is the map, not the territory. Counsel localizes it._

## 3. What the AI may and must NOT do

**May** (encoded in `config/credit-compliance.json → conduct_rules.ai_may`):
- Educate on scoring, reports, funding readiness.
- Help users dispute **inaccurate/unverifiable** items themselves.
- Build budgets, readiness checklists, organize documents.
- Explain options + general eligibility in plain language.

**Must NOT** (`conduct_rules.ai_must_not`):
- Promise/imply guaranteed deletions, scores, or funding.
- Advise removing **accurate** information.
- Create/suggest **CPNs / synthetic identities / new credit files**.
- File or draft knowingly false/frivolous disputes.
- Give legal advice or draft binding legal documents.
- Tell anyone to stop paying lawful debts.
- Collect **advance fees** for credit-repair work not yet performed.

## 4. The runtime guardrail (enforced, not aspirational)

Every consumer-facing output passes the checker before it's sent:

```bash
node scripts/compliance-check.mjs --product credit_repair path/to/output.txt
# exit 1 + "DO NOT SEND" if any prohibited claim; warns on missing disclosures
```

- **Blocks** prohibited claims (guarantees, "+N points", CPN, "erase debt", etc.).
- **Warns** when required disclosures are missing from the output/contract/UI.
- Pairs with the existing agent compliance layer (`src/lib/agent/compliance/*` on
  master: banned-phrases, disclaimers, opt-out, quiet-hours) and the **verify-gate**
  — a credit/funding message that fails this check does not ship.

Wire it into the agent send path and into CI/`verify.checks` for any
consumer-facing copy.

## 5. Required disclosures & fees

- **Disclosures** (`required_disclosures`): "educational guidance, not legal/financial
  advice"; "results vary, no guarantee"; CROA rights (free self-dispute, 3-day cancel,
  no pre-payment for credit repair); funding ("not a lender/broker unless licensed",
  "not a securities offering").
- **Fees** (`fee_rules`): **NO advance fees** for credit repair; charge only after
  services performed; written contract; 3-business-day cancellation.

## 6. The pre-sale gate (owner backstop — cannot be automated)

Before charging **anyone**, all of these must be true (`config → pre_sale_gate`):

1. Counsel-reviewed CROA-compliant contract + disclosures.
2. Fee structure with **no advance fees** for credit repair.
3. State CSO **registration + surety bond** where required.
4. Funding side: licensing reviewed; **no securities offering** without compliance.
5. Consumer-PII privacy (GLBA/FCRA) reviewed.
6. The banned-claims guardrail enforced on all consumer output.

This is backstop #5 in `docs/OPERATOR-RUNBOOK.md` — a human (you + counsel) gate. The
AI can prepare everything up to it; it cannot clear it.

## 7. How the partnership runs

- **Moe Legacy** = the regulated, registered operating company (the licensed face,
  the contracts, the consumer relationship).
- **TMMT OS + AIXMOS** = the platform + AI agents (guidance, workflow, the network),
  delivered as the Legacy edition + (when licensed) the AI brain.
- **Sell to anyone** — businesses, individuals, home use — each behind the same
  compliance guardrail and disclosures. Compliance is the feature that lets it scale.

---

_Config: `config/credit-compliance.json` · Guardrail: `scripts/compliance-check.mjs`
· See `docs/OPERATOR-RUNBOOK.md` (backstops), `docs/LEGACY-DEPLOY-MOE.md`,
`docs/CLIENT-ONBOARDING-DISCOVERY.md`. Master File §7 FLAGS._
