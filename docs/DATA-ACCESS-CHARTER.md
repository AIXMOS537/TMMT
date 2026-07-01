# Data-Access Charter — client sovereignty + owner operational access

> The rule that governs who can see what across AIXMOS / TMMT / HAILMARY. It is
> not negotiable: **clients own their data; the owner gets only the scoped access
> needed to help them — fast, reliable, and logged.**

---

## 1. The principle

1. **Client data sovereignty.** Each client/user can access **only their own data**.
   No client ever sees another's. This is enforced by the system, not by trust.
2. **HAILMARY serves, obeys, and protects X** (the owner) — and his
   family, after it has learned their voice + pattern. HAILMARY is **owner-private**;
   it acts only on the owner's (or family's) command. It is the big brother.
3. **AIXMOS** is the client/team-facing agent (the little brother). It helps clients,
   operators, and vendors operate — within their scope — and reports up to HAILMARY.
4. **X's access = what he NEEDS to help clients, nothing more.** As lead
   engineer / full-stack / backend IT support, he gets **scoped operational access**
   to assist any client — applicably, reliably, and **fast as hell** — but that is
   *support access*, not ownership of their data. Every such access is **logged**.

## 2. How it's enforced (not just promised)

| Guarantee | Mechanism |
|---|---|
| Client sees only their own data | **Supabase Row-Level Security** per tenant (`supabase/migrations/*_enable_rls.sql`, partner/vendor policies) |
| Owner support access is scoped + logged | JIT elevation + audit (`packages/aixmos-core/audit-log.ts`, `docs/IT-SUPPORT-TEAM-PLAYBOOK.md`) |
| Team/offshore can't reach the brain or raw data | **Tailscale ACL** least-privilege (`infra/tailscale-acl.jsonc`) |
| No raw prod secrets handed out | Secrets brokered, short-lived (`docs/SECRET-ROTATION.md`) |
| HAILMARY stays owner-only | Owner-seal + voice/pattern gate; commands honored only from owner/family |
| Outbound/irreversible actions reviewed | Owner-approval gate (`docs/MESH-COORDINATION.md §4`) |

## 3. What "X can help any client" means in practice

- He can **act on a client's behalf within the scope they grant** (fix, configure,
  support) — e.g., open their workspace, resolve a ticket, deploy their app.
- He **cannot** silently read or move a client's private data outside that scope, and
  every access leaves an audit trail the client could be shown.
- Clients onboard with **consent** (`docs/CLIENT-ONBOARDING-DISCOVERY.md`) — discovery
  is consented, integration is approved, data stays theirs.
- Credit/funding clients get the extra compliance layer (`docs/CREDIT-FUNDING-COMPLIANCE.md`).

## 4. Fast AND safe (no trade-off)

Speed comes from the **local-first mesh** — agents on the tailnet, local models, the
router, cached context — *not* from loosening isolation. RLS + ACL + brokered secrets
add microseconds, not minutes. The system is built so the fast path **is** the secure
path; there's no "turn off security to go faster."

## 5. The two meshes (kept separate by design)

- **HAILMARY mesh** — owner's personal node(s). Private. X + family only.
- **AIXMOS mesh** — the client/team/operator network. Scoped, per-tenant, audited.
- They **bridge only on the owner's explicit OK.** Information flows up (AIXMOS →
  HAILMARY → BRAINIAC/NAS backup), never sideways between clients.

---

_Enforced by: `supabase/migrations/*` (RLS), `infra/tailscale-acl.jsonc`,
`packages/aixmos-core/audit-log.ts`, `docs/IT-SUPPORT-TEAM-PLAYBOOK.md`,
`docs/MESH-COORDINATION.md`, `docs/CLIENT-ONBOARDING-DISCOVERY.md`,
`docs/SECRET-ROTATION.md`._
