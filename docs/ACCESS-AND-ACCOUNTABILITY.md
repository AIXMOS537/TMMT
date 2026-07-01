# Access & Accountability — the door, and the rule of the table

> Two laws:
> **(1) No one gets in without the owner's YES.**
> **(2) If someone gets in who shouldn't have — whoever opened the door leaves too.**
> The owner (X) is the table. The table is never revoked. Everyone else eats by
> invitation, and the invitation carries responsibility.

---

## Getting in (the only way)

There is exactly one path through the door:

1. A person runs the mission-gated onboarding (`dist/onboard.command` / `.bat`) and
   agrees to the Standards + confidentiality. No agreement → no card.
2. They send their card. The owner runs `bash scripts/grant.sh <card>` and types
   **YES**. Nobody — no script, no agent, no teammate — can self-grant.
3. The grant records **who vouched for them** (`sponsored_by`). By default that's
   X. If an operator brings someone in, the operator's name goes on the line.
   That signature is the accountability.

Everyone starts in DEV, scoped by role, with **brokered** secrets (never raw keys),
reachable only through the least-privilege Tailscale tag. Their reach never exceeds
their grant.

## Going out (instant, and accountable)

```bash
bash scripts/revoke.sh <name>              # remove one person, clean off-boarding
bash scripts/revoke.sh <name> --breach     # + remove whoever opened the door
bash scripts/revoke.sh chain               # who's in + who vouched for each
bash scripts/revoke.sh log                  # the full revocation history
```

**Plain revoke** pulls one person's seat and prints the exact off-boarding steps:
remove their Tailscale device, rotate any brokered secret they could've seen, delete
their app login, remove their portal seat.

**`--breach`** is the rule of the table. When unauthorized entry traces to someone,
revoke removes them **and walks the sponsorship chain** — whoever vouched for them
is out too, and whoever vouched for *that* person, and so on. The cascade stops at
the owner: **X is the table and never leaves.** Every removal is logged with the
reason and the chain.

> The point isn't cruelty — it's that a vouch is a real signature. If you open the
> door for someone, their breach is your breach. That's what keeps the door honest
> without the owner having to police every introduction.

## How "no one unauthorized gets in" is actually enforced

The door isn't a promise — it's enforced in layers (watched by `scripts/sentry.sh`):

| Layer | Keeps out |
|---|---|
| Middleware `getUser()` gate | anyone unauthenticated, off every protected route |
| Tier check (`pathAllowedForTier`) | authenticated users reaching above their role |
| Fail-closed webhook/cron secrets | anyone POSTing to an endpoint without the secret |
| Admin table allowlist + staff check | any write outside the sanctioned tables |
| Supabase RLS | seeing any row that isn't yours — even if the app is bypassed |
| Tailscale ACL (least privilege) | reaching the brain/secrets instead of just support surfaces |
| Brokered, short-lived secrets | walking away with a raw production key |

If any of those quietly weakens, the **Sentry** fails the perimeter and it surfaces
in the **CEO brief's 🔴 ON FIRE** the next morning. The **guardian** (`protect.sh`)
covers identity, locks, and confidentiality.

## The standing rules

- **One YES per person, by the owner only.** No self-grants, ever.
- **A vouch is a signature.** Sponsor someone, you own their conduct.
- **Breach = the door-opener leaves too.** The cascade is automatic and logged.
- **The owner is immune.** X is the table; the table is never revoked.
- **Revoke is reversible only by a new grant.** Out means out until a fresh YES.

---

_Tools: `scripts/grant.sh` (in), `scripts/revoke.sh` (out + cascade). Enforced by
`middleware.ts`, `admin-actions.ts`, `supabase/migrations/*` (RLS),
`infra/tailscale-acl.jsonc`. Watched by `scripts/sentry.sh` + `scripts/protect.sh`._
