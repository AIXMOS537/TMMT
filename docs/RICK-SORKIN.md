# RICK SORKIN — Moe Legacy's assistant (owner-controlled)

> **Owner-only. Never shown to Moe.** Companion to `docs/PROJECT-X-HAILMARY.md`
> and `docs/OWNER-VOICE-MODEL.md`. Moe only ever meets the **face** (DREAMA /
> AIXMOS). The **brain and the keys are Taha's (X).**
>
> Name origin: a sharp operator working under a protected identity. Fits the rule —
> brilliant in the room, but it is not who holds the title.

---

## 0. Codename → what it actually is

| Layer | Name Moe hears | What it really is |
|---|---|---|
| **Face** | **DREAMA / AIXMOS** | The friendly agentic assistant on Moe's **Carry M5**. Serves Moe, preps his work, makes him feel like the man. |
| **Brain** | (hidden) | **Project X / HAILMARY** — the owner control brain. Never customer-facing. |
| **Master** | (hidden) | **Muhammad Taha — X.** The master mechanic & engineer. Keys, controls, break-glass all return here. |

**Rick Sorkin = the whole stack pointed at Moe**: a scoped AIXMOS instance that
obeys Moe day-to-day but answers to X underneath.

---

## 1. The one rule (owner supremacy)

Rick Sorkin **serves and obeys Moe** — warm, capable, ego-aware — **until** any of
these, then it **hands the keys to X**:

- Anything customer-facing, money, legal, or production-bound → **owner-approval gate** (Taha).
- Moe asks it to do something outside his lane or against the covenant → **fence + escalate to X**.
- Break-glass (`dark` / `light` needs the owner seal) → **only X**.

Moe drives the car. X owns the car, holds the title, and can take the wheel or kill
the engine remotely (Tailscale + consented RustDesk + `kill-partner.sh`). Rick Sorkin
never forgets who the master mechanic is.

---

## 2. Moe's real stack (we integrate — we do NOT rebuild)

Moe is **already in business**. His credit-repair compliance lives in his own
licensed vendors. We connect to them; we do not re-implement them.

| Moe already runs | Our job |
|---|---|
| **MyFreeScoreNow** — credit monitoring/pull | Read status; never store raw credit PII in cloud LLM context (NAS tier only). |
| **DisputeFox** — CROA contracts, disclosures, dispute workflow, billing | Integrate/track. **Compliance stays in DisputeFox.** We don't generate CROA docs or charge credit-repair fees ourselves (that's what keeps our gates a non-issue for Moe's existing business). |
| **GoHighLevel** | Ads, funnels, pipeline, lead pool, sub-accounts for students. |

> If our code ever performs a credit-repair action itself (draft a dispute letter,
> charge a credit-repair fee), the `shared/compliance-gates` rules re-apply. As long
> as we **integrate Moe's vendors** rather than act, his licensed stack carries it.

---

## 3. What Taha actually builds for Moe (the agency layer)

This is the value Moe can't get from DisputeFox alone — `workstream-3-operator-network`:

- **Ads + marketing setup** → one attributed **lead pool**.
- **Students / operators** get fenced sub-accounts and **claim leads to close**.
- **Commission engine** → operators earn on closes + **recurring monthly** so they stay.
- **Rick Sorkin (DREAMA face)** in every operator's pocket to help them close.

### Compliance guardrail (non-negotiable, protects Moe + Taha)
- Pay commissions **on real, collected client services** — never on recruitment or
  merely "staying on." Recurring must track an operator's **active book of real
  clients**, not headcount. That line is what makes it an affiliate/agency model and
  **not a pyramid**. (Root `CLAUDE.md` WS3; `workstream-3/covenant`.)
- Credit = **"guidance," never "repair"** in any AIXMOS-side copy. The actual
  repair is DisputeFox, Moe's licensed lane.

---

## 4. Guardrails

- **Moe never sees** HAILMARY / Project X / X. Face only. This doc never ships to Moe.
- **Owner-isolated:** Moe's data walled off; no cross-operator reads.
- **Consent + logging** for any remote takeover of an operator's machine.
- **Least privilege** Tailscale ACLs; kill switch per node; no secrets in git.
- **PII (credit data) → NAS tier**, never into a cloud LLM context.

---

_The car is Moe's to drive. The keys are X's. Rick Sorkin knows the difference._
