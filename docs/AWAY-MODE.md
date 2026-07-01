# Away Mode — the digital verse runs while the master is out

> The owner is often **physically away handling business**. That's *why* the digital
> verse exists: so the empire keeps moving without him — and the decisions only **he**
> can make wait for him in a clean queue, instead of stopping the world or blowing up
> his phone. The backstops still hold; they just go **asynchronous**.

---

## The principle
- **Keep moving.** Agents and operators do the safe ~90% on their own — routine work,
  intake, drafts, fixes, follow-ups, lead-setting. Nothing waits on the owner for that.
- **Queue the rest.** Anything that needs the owner's YES (the 5 backstops) is **added
  to the queue** instead of pinging him or being skipped. The world doesn't stop; the
  decision just waits.
- **He clears it in batches.** When he's back at a device, he opens the queue, decides
  yes/no down the list, and it's done. No phone blowups (the phone rule), no bypass
  (the gate still holds).

## What runs autonomously vs. what queues
| Runs on its own (away or not) | Goes to the QUEUE for the owner |
|---|---|
| Intake, triage, drafting, research | Merge to prod / deploy a business |
| Operators working their lanes (Justin booking, Red Hood ads*) | Anything irreversible/outward (send to real contacts, delete, rotate secrets) |
| Account hardening, verify-gate, scans | Granting access / onboarding a new person |
| Compliant ad copy (passes check-my-ad) | Pricing, deals, money out |
| Everything green that's within role scope | Compliance go/no-go (credit/funding) |

\*within the compliance guardrail — illegal claims are auto-blocked regardless.

## How it works (the tools)
- An agent/operator hits a decision only the owner can make → they run:
  ```bash
  bash scripts/queue.sh add "what needs your YES" --from <who> --risk low|med|high
  ```
  The item waits; **they keep working on everything else.**
- The owner, whenever he's back:
  ```bash
  bash scripts/queue.sh          # his inbox — color-coded by risk
  bash scripts/queue.sh yes <id> # approve   ·   no <id>  # deny
  ```
  Every decision is logged. Empty queue = "nothing needs you; you're free."

## Why this protects him
- **He's never the bottleneck** — the empire runs while he's out earning/handling life.
- **He never loses control** — the 5 backstops still require his YES; they just *wait*
  for him instead of stopping everything or interrupting him.
- **His phone stays quiet** — non-emergencies are a queue he checks, not a stream of
  pings (the Operator Standard phone rule, made real).
- **Nothing rogue happens** — no agent or operator can self-approve the queue. Owner only.

> The master built the digital verse so it could carry the load while his hands are
> busy with the world. Away Mode is that promise, kept: **it moves without him, and it
> waits for him.** 👑

---

_Tools: `scripts/queue.sh`. See `docs/OPERATOR-STANDARDS.md` (phone rule),
`docs/AIXMOS-CONSTITUTION.md` (Law of Loyalty), `docs/DATA-ACCESS-CHARTER.md`._
