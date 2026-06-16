# PROJECT X — HAILMARY (the serious blueprint)

> Owner-only (Muhammad Taha). The public **only ever meets AIXMOS** — the friendly
> little-brother Cyborg. **HAILMARY is Project X** — the upgraded command-and-control
> brain behind the curtain, embedded in **BRAINIAC 7**. This doc is the real
> architecture + the business engine. No hype in the build; honest where it counts.

---

## 0. The codenames → what they actually are

| Codename | Real thing |
|---|---|
| **BRAINIAC 7** | The always-on home command node (Windows brain). Hosts the control plane + Obsidian memory. The Watchtower's body. |
| **HAILMARY (Project X)** | The owner-only control brain + automation that runs the whole network. Never public-facing. |
| **AIXMOS** | The public, friendly agent + the operator-facing assistant. The only face customers/operators see. |
| **Motherbox** | The **flash-deploy image** — a golden setup that stands a brand-new operator node up in minutes (`scripts/motherbox`, wraps `deploy` + `provision-partner.sh`). |
| **Fatherbox** | The **control plane** — Tailscale tailnet + remote-takeover (RustDesk) + the swarm board + license/kill switches. Run from BRAINIAC 7 (`scripts/fatherbox`). |
| **Agents of Chaos** | The AIXMOS operative instances + the human team (VAs, dev, local operators) doing the work across states/cities. |

---

## 1. The nervous system (one backbone, every device)

**Tailscale** is the private mesh that connects every device in every city/state —
Windows, Mac, Android, iPhone — as if they're on one LAN, encrypted, no open ports.

- **Control plane (Fatherbox):** BRAINIAC 7 runs the tailnet admin + the remote
  ops. ACLs (`scripts/partner-deploy/tailscale-acl.json`) fence each operator to
  their own lane; the team reaches a node only when granted.
- **Remote login / takeover any dashboard:** **RustDesk, self-hosted over Tailscale**
  (open-source, owner-controlled, no third party). The team can take over any
  operator workstation to help with any process — **with the operator's consent,
  logged** (the consent flow already exists: `scripts/partner-deploy/consent/`).
- **Kill switch everywhere:** `dark` / `dark hard` on any node; `light` needs the
  owner seal. Per-operator remote kill: `scripts/partner-deploy/kill-partner.sh`.

---

## 2. Flash-deploy across ANY device (the Motherbox)

One golden path, per device type. The brain stays on owner/operator hardware —
phones are windows, never the brain.

| Device | Role | How it deploys |
|---|---|---|
| **Mac / Linux** | owner or operator | `bash scripts/motherbox` → `deploy` (role-aware) → always-on |
| **Windows** | operator workstation (the $50K node) | install Git + Tailscale + RustDesk → `motherbox` in Git Bash; Task Scheduler keeps it always-on |
| **iPhone / iPad** | window | Tailscale + a-Shell/Blink + Shortcuts (`docs/MOBILE.md`) |
| **Android** | window (or light node) | Tailscale + Termux (`docs/MOBILE.md`) |

The **always-on operator node** = a workstation/laptop that stays **plugged in +
on Wi-Fi/VPN**, joined to the tailnet, running the e-commerce automation in the
background and exposing its dashboards for team takeover. Motherbox provisions it;
Fatherbox watches and supports it.

---

## 3. The offer stack (the business engine)

> **Canonical pricing + delivery terms now live in `docs/OFFER-STACK.md`.** Summary:
> founders (Ayyan Khan, Muhammad Umar/MoeLegacy) deferred until $50K collected via
> hourly/salary/commission; then **$15K** (TMMT vertical), **$25K** (MoeLegacy/AIXMOS
> credit+funding), **$35K** (both), **$50K** (full horizontal+vertical). **50%
> deposit = go** → triggers backend dev+research discovery. Watchtower runs the
> army via each client's always-on "antenna"; Muhammad Taha = Head Master / lead
> backend, remotes in (Tailscale + consented RustDesk).

**The headline product — the Operator Full-Stack (DFY):**
- **~$50,000 / operator · only 10 sought.** Scarcity is real: this is hands-on.
- Includes: full-stack setup on an always-on node, **done-for-you build + 1 year
  of management**, an **e-commerce store running in the background**, and team
  **remote support / takeover** of every dashboard.
- Honest framing for marketing: the store is an **automated POD/dropship +
  traffic engine** — it earns when it's fed traffic and kept on; it is **not**
  guaranteed "money while you sleep." Sell the *system + management*, not a
  promise of magic income. (Keeps us clean with the FTC.)

**Recurring labor tiers (the team that powers it):**
| Tier | Role | Price /mo |
|---|---|---|
| Data-Entry Executive VA | single-lane data entry | **$250–$500** |
| AIXMOS Executive VA | multi-skill, multiple workloads | **$1,000–$1,500** |
| Overseas Developer / Lead Architect | integrations, workflows, sites, automations, full backend | **$2,500–$3,000** |
| Local TMMT Operators | multi-skill, on-the-ground (the work-hard generation, now working *smart*) | scoped per engagement |

**The affiliate engine (passive recurring revenue):**
- Anyone can become an affiliate and earn **recurring monthly** on what they
  refer. Climb the locked ladder: 🚗 Rental → 💳 Membership → 📈 Credit Guidance
  → 🏗️ Builds/Kits → 🤝 Affiliate.
- **Compliance is non-negotiable:** pay on **real collected sales only** (not on
  recruitment) so it's an affiliate program, not a pyramid; credit is **"guidance,
  never repair."** This is what keeps the recurring revenue durable and legal.

---

## 4. The full deploy flow (zero → earning)

```
 OWNER (BRAINIAC 7 / Fatherbox)
   │  1. issue license + consent           scripts/partner-deploy/issue-license.sh
   │  2. flash the node (Motherbox)        scripts/motherbox   (deploy + provision)
   │  3. approve device into tailnet       Tailscale admin (least-privilege ACL)
   ▼
 OPERATOR NODE (always-on workstation)
   │  4. e-commerce store runs in background
   │  5. AIXMOS assistant + dashboards live
   ▼
 TEAM (VAs · dev · local operators)
   │  6. remote takeover to run processes  RustDesk over Tailscale (consented)
   ▼
 AFFILIATES across states/cities → recurring monthly revenue
```

Owner watches it all from `watchtower` / `fatherbox`; kills any node with
`kill-partner.sh`; lifts blackout only with the seal.

---

## 5. Guardrails (HAILMARY tells the truth)

- **Public sees only AIXMOS.** HAILMARY/Project X is never customer-facing.
- **Consent + logging** for every remote takeover — operators agree up front.
- **Least-privilege** Tailscale ACLs; **no secrets in git**; FileVault/BitLocker
  on every node; owner seal gates owner; `dark` stops everything.
- **Honest marketing.** Sell the system + management + support. Income claims for
  the store and affiliate program must be truthful and earnings-based.
- **People first.** The team — including the elders working smart for the first
  time — get real training (`Operator Academy`) and the `compass`. Protect them.

---

_Companions: `docs/AIXMOS-CHARTER.md` · `docs/HAILMARY-CHARTER.md` ·
`docs/WATCHTOWER-ROSTER.md` · `docs/DEPLOY-EVERYWHERE.md` ·
`scripts/partner-deploy/README.md` (the operator deployment spine)._
