# Cost-Cut & Anti-Staleness — spend less, let nothing rot

> Two goals, one discipline:
> **(1) Cut every recurring dollar that isn't earning.**
> **(2) Make the things that go stale and drag the business become obsolete** —
> by automating them away so they can't rot silently.
>
> One command surfaces it all: **`bash scripts/costcut.sh`** (read-only) ·
> `--apply` fires the safe automatic cuts.

---

## The mental model

You already own the expensive parts: your Macs, the brainiac PC, your tailnet.
**Money should only leave the building on the rare task that genuinely needs a
frontier model or a hosted service.** Everything routine runs on hardware you've
already paid for. Anything that has to be done by hand more than twice becomes a
script — so it costs you time *once*, not forever.

```
 local-first by default   →  near-zero marginal cost
 escalate by exception     →  pay only on the HARD task
 automate the repeatable   →  staleness can't accumulate
```

---

## 1. AI spend — the biggest recurring lever

| Drain | Fix |
|---|---|
| Every call hitting a paid API (Claude/OpenRouter) | LiteLLM router: EASY/MED → local models on your hardware; HARD → hosted. `docs/LOCAL-FIRST-AI-STACK.md` |
| Per-seat AI subs (Cursor/Copilot) × each operator | One shared LiteLLM endpoint on the tailnet — operators hit local, not their own paid seats |
| Hosted keys used as the *default* path | Keep `ANTHROPIC_API_KEY` etc. as **escalation-only**; local handles the 90% |

**Rule:** local by default, escalate by exception. Most coding/ops/triage never
leaves your tailnet, so it costs nothing per call.

## 2. Hosting (Vercel)

- **Duplicate projects re-deploy the same repo on every push** — `tmmt-c919` and
  `tmmt` each burn build minutes for nothing. Keep the three real apps
  (`tmmt-ops`, `tmmt-command-center`, `aixmos-landing`); retire the rest:
  `bash scripts/retire-vercel-duplicates.sh --apply`.
- **Preview deploys on every branch** eat the free tier. Limit previews to PRs
  that touch app code; mute swarm-coord branches.

## 3. Databases (Supabase)

- **Consolidate tenants behind RLS on ONE project** — you already have RLS, so
  extra projects are pure cost/maintenance. Pause or delete unused ones.
- **Free-tier projects auto-pause when idle** and then look broken to a client.
  Keep live ones warm (`scripts/heartbeat.sh` + a weekly ping); delete the dead.

## 4. Subscriptions — the silent monthly bleed

Cancel anything used by fewer than one person, or not in the last 30 days. Less
spend **and** less attack surface. Your `config/account-inventory.example.tsv`
already lists the subscription rows — walk the bank/Stripe statement against it
once a month.

## 5. Staleness — what rots if you don't automate it away

| Rots into | Made obsolete by |
|---|---|
| Leaked/expired keys | `scripts/secret-scan.sh` + rotation (`docs/SECRET-ROTATION.md`); **revoke the Airtable PAT** (only you can — your account) |
| Dead git branches confusing deploys | prune monthly: `git push origin --delete <branch>` |
| Drifting npm deps (security holes, broken builds) | `npm outdated` → deliberate bumps → `npm run build` gate |
| Misleading docs/roadmap | review `STATUS.md` + `ROADMAP.md` monthly; delete shipped, cut YAGNI |
| Machines/logins going soft | `scripts/device-integrity.sh`, `scripts/account-hardening.sh` |
| Decisions stalling while you're away | `scripts/queue.sh` (Away Mode) keeps them moving |

The pattern: **a thing only goes stale if a human has to remember to touch it.**
Move the remembering into a script and the staleness becomes impossible.

## 6. Your time — the costliest line item

- `scripts/new-business.sh` stamps a whole business in one command — zero rebuild
  cost per launch.
- `scripts/queue.sh` lets the digital verse keep moving while you handle things
  physically.
- **Anything done by hand more than twice = a script you don't have yet.** Queue
  it; the next idle build turns it into one command.

---

## The one-line plan

1. **AI** — local by default, pay only on HARD (`docs/LOCAL-FIRST-AI-STACK.md`)
2. **Hosting** — kill duplicate Vercel projects (`retire-vercel-duplicates.sh --apply`)
3. **Database** — one Supabase + RLS, delete the rest
4. **Subs** — cancel anything unused in 30 days
5. **Rot** — rotate the Airtable key, prune branches, `npm outdated`, review docs monthly
6. **Time** — automate anything done >2×; queue the rest

_Audit anytime: `bash scripts/costcut.sh`. Nothing here charges money or deletes
anything without your `--apply` (and even then, only the safe automatic cuts)._
