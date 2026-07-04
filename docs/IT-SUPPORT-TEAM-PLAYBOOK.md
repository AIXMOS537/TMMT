# IT / Technical-Support Operations — Offshore Backend Team Playbook

> How **X** runs as the **Tier-1 owner / IT lead** with a trusted
> backend team in **Pakistan and the Philippines** doing the heavy lifting —
> safely. The whole design follows one rule:
>
> **The team can help with everything except what could hurt you.**
> Scoped access to support surfaces; never the brain, the secrets, or customer PII.
>
> Grounded in the AIXMOS Master File (§1 tailnet mesh, §2 role-scoped operators,
> §7 FLAGS) and `packages/aixmos-core` (`audit-log.ts`). Pairs with the
> enforceable network policy in `infra/tailscale-acl.jsonc`.

---

## 1. Coverage model — follow-the-sun (your edge)

| Region | UTC | Covers (local 9–6) in ET | Role |
|---|---|---|---|
| **Philippines** | +8 | ~9pm–6am ET | Overnight backend / monitoring (Tier-2) |
| **Pakistan** | +5 | ~12am–9am ET → midday overlap | Backend eng / deeper fixes (Tier-3) |
| **You (ET)** | −4/5 | daytime | Tier-1 owner, approvals, customer-facing |

Three time zones = **near-24h coverage**. You orchestrate and approve; they
execute inside their scope. That's what makes you the #1 support person — you're
never the bottleneck and never alone.

## 2. Identity & access — the non-negotiables

1. **One account per person.** Never share logins. Named accounts = real audit.
2. **MFA everywhere** (SSO + TOTP/hardware key). No MFA, no access.
3. **Least privilege by role** (matches Master File §2 + the Cloudflare role-broker):
   each person gets only the persona, model tier, systems, and data their role needs.
4. **No standing access to production secrets or customer PII** for offshore roles.
   Secrets are brokered, scoped, and short-lived (see §4).
5. **Just-in-time elevation:** sensitive task → request → you approve → time-boxed
   grant → auto-revoke. (The mesh approval gate, `docs/MESH-COORDINATION.md §4`.)

## 3. Network & remote access — tailnet only

- Everyone joins the **Tailscale tailnet**; nothing is port-forwarded to the public
  internet. The brain hub (Ollama), NAS, and DBs are **tailnet-only**.
- **Remote control = RustDesk over Tailscale** (Master File §1), never public RDP/VNC/SSH.
- Offshore nodes are **tagged** (`tag:offshore-pk`, `tag:offshore-ph`) and the ACL
  (`infra/tailscale-acl.jsonc`) restricts them to support surfaces — **not** the
  brain port, secrets host, or admin DB. Enforced by the network, not by trust.

## 4. Secrets — brokered, never handed out

- Offshore team **never** receives raw production keys (Supabase service role, GHL,
  Stripe, Airtable PAT, Vercel tokens).
- Use a **secrets broker / vault** (Cloudflare Workers role-broker per Master File,
  or 1Password/Doppler with scoped vaults): the app reads secrets at runtime; people
  get **scoped, expiring** items only for the task.
- App/CI uses **scoped service accounts**, not your personal tokens.
- If a secret is ever exposed, **rotate immediately** (see `docs/FLASH-DEPLOY-RUNBOOK.md §3`).

## 5. Audit & monitoring — see everything

- **Log every privileged action**: who, what, when, which system. Wire offshore ops
  through `packages/aixmos-core/src/audit-log.ts` / a central log.
- **Session capture** for sensitive work (RustDesk session notes / recording) with
  the person's written consent (Master File §7 monitoring FLAG — consent must be
  real, logged, revocable, and disclosed).
- **Alerts** on: failed logins, access outside role, after-hours admin actions,
  secret access. Sentry is already wired for app errors (`docs/SENTRY-SETUP.md`).

## 6. Support workflow — ticket in, fix out

1. **Intake:** all work as tickets (ClickUp + the git/mesh bus). No DM-driven prod changes.
2. **Severity & SLA:**
   - **Sev-1** (prod down / data risk): you + on-region eng now; you approve any fix.
   - **Sev-2** (degraded): same business day, region on shift.
   - **Sev-3** (task/improve): scheduled, on a branch, PR-reviewed.
3. **Change rule:** prod changes go **branch → PR → your approval → merge**. No direct
   pushes to `master` from offshore. (CI `npm run build` is the gate.)
4. **Handoff at shift change:** outgoing region writes a `HANDOFF.md` via
   `scripts/mesh-handoff.sh` so the next region wakes with full context.

## 7. Onboarding a team member (grant — checklist)

- [ ] Signed contractor agreement + **NDA** + monitoring-consent (Master File §7).
- [ ] Named account in SSO; **MFA enforced**; added to their **role group only**.
- [ ] Tailscale invite; device tagged `tag:offshore-pk` / `-ph`; verify ACL scope.
- [ ] RustDesk set up over Tailscale (no public exposure).
- [ ] Vault access to **scoped** items only; zero raw prod secrets.
- [ ] Read access to their runbooks + this playbook; acknowledge the rules.
- [ ] Test ticket end-to-end before any real prod-adjacent work.

## 8. Offboarding (revoke — do SAME DAY, this is the risk)

- [ ] Disable SSO account + revoke MFA.
- [ ] Remove from Tailscale (device key revoked) and all role groups.
- [ ] Revoke vault access; **rotate any secret** they could have seen.
- [ ] Remove RustDesk, repo/Vercel/Supabase/ClickUp/GHL access.
- [ ] Confirm in the audit log that access is fully closed.

## 9. Data handling & compliance

- **Tenant/customer data isolation** (Master File §7): offshore roles work against
  scoped/anonymized data where possible; production PII access is JIT + logged.
- RLS already isolates data per org (`supabase/migrations/20260331_enable_rls.sql`).
- Cross-border data: keep customer PII access minimal, logged, and contract-bound.
- Don't let monitoring/screen-capture pull personal (non-work) data — scope it.

## 10. Be the #1 support person (so you scale, not firefight)

- **Runbooks first:** every recurring issue gets a written fix (`docs/SUPPORT_RUNBOOK.md`).
  The team executes runbooks; you only handle the novel + the approvals.
- **Knowledge base** the team maintains; agents draft, you approve.
- **On-call rotation** by region; you're escalation, not first-response.
- **Weekly review:** incidents, SLA hits, what to automate next. Automate the top
  repeat. That loop is what makes one owner + a lean offshore team feel like a 24/7
  enterprise IT desk.

---

_See also: `infra/tailscale-acl.jsonc`, `docs/MESH-COORDINATION.md`,
`docs/SUPPORT_RUNBOOK.md`, `docs/FLASH-DEPLOY-RUNBOOK.md`, AIXMOS Master File §2/§7._
