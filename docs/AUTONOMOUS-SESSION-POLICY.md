# Autonomous Session Policy — forgotten work never needs you

**Problem:** you start chats/sessions, they produce open PRs and branches, then you
forget them. They sit waiting on a human. This policy + the reaper loop make sure
**every piece of open work is driven to a terminal state with zero input from you.**

You can't resurrect an old chat transcript — but the *work* it left (PRs, branches,
tasks) is what matters, and that never has to wait on you again.

## The loop (scheduled trigger — no human needed)

A recurring trigger fires on its own (fresh session each time; the repo is its
memory) and, every run:

1. **List open PRs + branches** (agent-authored) and their CI state.
2. **Resolve each to a terminal state:**
   - **MERGE** — if green + safe: docs/scripts/config, or app-code whose tests pass,
     and it is **not** compliance-gated. Delete the branch after merge.
   - **CLOSE** — if superseded (its changes are already in `master`), abandoned
     (stale, conflicting, redundant), or duplicated by a newer PR. Leave a one-line
     reason. Delete the branch.
   - **REBASE / FIX** — if a small CI break or a merge-conflict is the only blocker
     and the fix is obvious and safe, do it, then merge.
   - **ESCALATE ONCE** — only if it needs a genuine human decision (legal/compliance
     sign-off, a credential, a pricing number, a customer/money/production action).
     Push one phone-readable notification with a **recommended one-word answer**,
     then leave it parked. Do **not** nag; keep everything else moving.
3. **Delete merged branches** so the branch list stays == real open work.

## Hard safety rails (never crossed autonomously)

- Never auto-merge a **compliance-sensitive** change or **unverified app-code** — those
  wait for the flag owner (see CLAUDE.md §COMPLIANCE / §NON-NEGOTIABLE).
- Never **unlock a legal flag** (credit_repair / funding / dispatch stay owner-only).
- Never auto **send / pay / sign / ship / deploy** — the owner-approval gate
  (`.claude/hooks/owner-approval-gate.py` + `shared/owner-approval-gate/`) holds.
- Prefer **close with a note** over merging anything uncertain. A parked PR is safe;
  a wrong merge is not.

## What "terminal" means

Every PR ends **merged** or **closed**. Every branch is either the tip of an open PR
or **deleted**. Nothing lingers in a "waiting on a human who forgot" state — the only
things left open are the handful genuinely escalated to the owner, each with a
one-word way to resolve it.

## Escalation contract

When the loop truly needs you: **one** push/email, phone-readable, with a recommended
default so you reply with a single word (or ignore it — it stays parked, everything
else still moves). Silence is a valid answer; it just means "leave it parked."

## Cadence

The reaper runs on a schedule (a Claude Code Remote trigger). Change cadence any time
with one word to any session: *faster / slower / pause / louder / quieter*. See also
the daily **AIXMOS Autonomous Operator Loop** (advances new safe work + repo health);
the reaper is the same doctrine aimed specifically at **closing out stale/forgotten**
open work.
