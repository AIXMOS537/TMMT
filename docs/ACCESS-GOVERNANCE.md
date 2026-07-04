# Access Governance — authorize fast, revoke hard

> How X (PROJECT X HAILMARY) keeps a **clear path for himself**, a **fenced path for
> everyone else**, **flash-deploys** the moment he authorizes, and **cuts off**
> anyone unauthorized — completely and fast. Defense and revocation, done right.

**Identity:** **X = PROJECT X HAILMARY** — the owner. (Public-facing brand node is also
**X = AIXMOS** per `security/X-NODE-DEFINITION.md`; the person and the front share
the name by design.) The network being built: **Project X HAILMARY** (owner +
family/friends, invite-only) and **Project X AIXMOS** (the public operator
network), with **MOE LEGACY** as a flagship partner.

---

## The two paths (least privilege = the "clear path")

The clean version of "a clear path for me, but anyone chasing gets stuck": it's
**least privilege**, not booby-traps. The owner moves freely; everyone else only
ever sees the door they were given.

| | Owner (X) | Operator / partner |
|---|---|---|
| Access | Full mesh, the brains, the seal | **Fenced** — only their subaccount + the surfaces granted |
| Brain (`tag:brain`) | Yes | **No** — ACL denies it (`infra/tailscale-acl.jsonc`) |
| Secrets | In the vault | **None on device** (Operator Portable Kit) |
| Authority | `auth/OWNER.seal` | Cannot self-grant — the seal gates it (`scripts/deploy`) |

A follower can't "chase" through the network because there's **no path to
chase** — every door they don't own is default-denied. That's stronger than a
trap, and it can't backfire on you.

## Authorize → flash deploy (no extra blockers)

Once **X authorizes**, delivery is fast and unattended — no second approval loop:

1. **X authorizes** — the Owner Seal (`scripts/owner-seal.sh`) + a license for
   the client/operator (`scripts/partner-deploy/owner/issue-license.sh`).
2. **Flash deploy** — `scripts/deploy` (role-aware) + the partner provisioner
   (`scripts/partner-deploy/provision-partner.sh`) stand up everything the client
   paid for. Pre-flight checks (`verify-readiness.sh`) catch errors *before* they
   block, so authorized deploys go clean.
3. **No owner babysitting** — because the authorization is the gate, not each
   step. Authorized = it ships.

> The rule that makes this safe: **nothing deploys that X didn't authorize.**
> Fast *because* it's gated, not despite it.

## Unauthorized access → quarantine, trace, revoke

If someone is on the network who shouldn't be — or an operator goes rogue:

1. **Detect** — integrity + presence already watch the fleet
   (`scripts/device-integrity.sh`, `scripts/mesh/presence.sh`,
   `docs/FLEET-PRESENCE-SECURITY.md`). Anything unexpected gets flagged.
2. **Take offline immediately** — `bash scripts/godark` (DARK) stops a node;
   `dark hard` drops it off the tailnet entirely. The node is parked, not
   trusted, until cleared.
3. **Trace the grantor** — every grant is a **named license** with an owner of
   record (`issue-license.sh` + the audit log, `audit-readout.sh`). You can see
   **who let them in**.
4. **Revoke completely** — `scripts/partner-deploy/owner/kill-partner.sh` cuts
   the device off: license revoked, tailnet access pulled, accounts
   de-provisioned. The grantor's trust is reviewed too. Full cut-off from the
   ecosystem.
5. **Recovery if it was a mistake** — `recovery-flow.sh` re-onboards cleanly once
   verified.

| Action | Command |
|---|---|
| Park a node now | `bash scripts/godark` |
| Drop it off the tailnet | `bash scripts/godark hard` |
| Revoke a partner/operator fully | `scripts/partner-deploy/owner/kill-partner.sh` |
| See who granted access | `scripts/partner-deploy/owner/audit-readout.sh` |
| Re-onboard after clearing | `scripts/partner-deploy/owner/recovery-flow.sh` |

## The line (why this is the version that protects X)

Building things that **actively harm, mislead, or "poison" people who probe the
network** — traps, deception payloads, "venom" — is **out of scope, and it would
work against you**:

- It converts a clean, defensible operation into **legal exposure** — the exact
  opposite of the GO GHOST principle: *"stay in the lane and the ghost holds up
  under scrutiny"* (`security/GO-GHOST-PROTOCOL.md`).
- It can hit the wrong person (a curious operator, a security researcher, an
  innocent) and create liability you can't ghost your way out of.
- It's **unnecessary.** Least-privilege walls + instant revocation already
  achieve the goal: outsiders get **nothing**, and anyone who slips in gets
  **cut off**. Keep them out and cut them off — don't attack them.

**Strong doors, fast keys, hard locks. No traps.** That's how X stays untouchable
*and* clean.

---

_Maps to: `infra/tailscale-acl.jsonc`, `scripts/deploy`, `scripts/owner-seal.sh`,
`scripts/godark`, `scripts/partner-deploy/owner/*`, `docs/FLEET-PRESENCE-SECURITY.md`,
`docs/security/GO-GHOST-PROTOCOL.md`._
