# Homeland HQ + Operator Seats — the model (owner intent, 2026-06-19)

> Captures the owner's direction: **home = the central homeland server/HQ**,
> extending into the **work office** once it's remodeled; **every operator**
> (MOE LEGACY + TMMT RENTALS) gets their **own subaccount + a one-shot per
> device**; and the **seat + tier pricing** below.
>
> This composes existing machinery — it does **not** replace it:
> `docs/OFFER-STACK.md` (pricing truth), `docs/LEARN-EARN-CHURN.md` (the $97/mo
> engine, `scripts/member`), the **Operator Portable Kit** spec
> (`docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md`),
> `scripts/deploy operator` (fenced device setup), `docs/FLEET-ROSTER.md`.

---

## 1. The homeland — HQ now, office next

- **Home = the homeland HQ.** The M1 (`brainiac-mac`, primary brain) + the $3k
  Windows build (`brainiac-win`, compute/backup) are the always-on core; the
  carry **M5** runs the show from anywhere. (Topology + one-shots:
  `FLEET-ROSTER.md`, `BRAINIAC-MAC-SETUP.md`.)
- **Office = the next node.** Once the office is remodeled, it joins the **same
  tailnet** as an extension of HQ — not a separate island. In-office
  workstations onboard exactly like any node (`scripts/deploy operator` for
  operator desks; owner desks get the full stack). Nothing about the model
  changes; the office is just more seats on the same mesh.
- **One mesh, one brain, many seats.** Home and office are the same private
  network. Operators reach what they're granted (fenced); the owner reaches
  everything; the brain is owner-only (`tag:brain` ACL).

## 2. Operator seats — own subaccount, one-shot per device

**Goal:** any operator of **MOE LEGACY** or **TMMT RENTALS** gets their **own
subaccount** and a **single command** that turns any device they own (Mac or
Windows) into a working seat — usable **at the office or on the move**.

This is the **Operator Portable Kit (OPK)** operator profile, already specced:
thin-client (browser + Tailscale + the few bookmarks they need), **zero secrets
on the device**, idiot-proof first-run. The one-shot today is
`bash scripts/deploy operator` (fenced, least-privilege).

**What "their own subaccount" needs (the gap to build):**

| Piece | Where it lives | Status |
|---|---|---|
| Membership/role record ($97/mo seat) | `scripts/member` + `.hailmary/members` | ✅ exists (local) |
| Fenced device setup (one-shot) | `scripts/deploy operator` | ✅ exists |
| **Per-operator subaccount** (isolated workspace/data) | GHL sub-account + Supabase `org_roles` / per-org scoping | ⚠️ **to build** — the isolation layer so each operator's customers/data are their own |
| Private mesh access (fenced) | Tailscale `tag:family`/operator tag + ACL | ✅ model exists |
| Brand theme (MOE LEGACY vs TMMT) | flagship portals (`LEARN-EARN-CHURN.md`) | ✅ exists |

> **The one real build item** is the **per-operator subaccount isolation** — so
> two operators on the same spine never see each other's customers/data. The
> seat ($97/mo) and the device one-shot already exist; the subaccount tenancy is
> what makes each seat truly *theirs*. I can spec + build this next on request.

## 3. Pricing — as stated (owner intent, verbatim)

| Tier | Price (as stated) | For |
|---|---|---|
| **Seat** | **$97 / month per seat** | Operator workspace: own subaccount + one-shot on any/all their devices; work at the office or on the move |
| **Credit guidance — basic** | **$1,875 / month** | Basic needs |
| **Mid-tier** | **$3,750 / month** | Fleet management, mid tier |
| **Everything** | **$7,500** | Anything and everything |
| **Agency** | **$15,000** | A full agency setup of their own |
| **Inner circle** | **$25,000** | Credit guidance + business-funding inner circle & network |
| **All things** | **$35,000** | Both + all things |
| **Enterprise 1:1** | **$45,000–$50,000** | Full 1:1 brain + stack buildout, ready to deploy — enterprise standard & scale |

> **Compliance (non-negotiable):** you said "credit repair" — customer-facing it
> is **"credit guidance," never "repair,"** and no guaranteed outcomes. See
> `docs/sops/CREDIT-GUIDANCE-SOP.md`. Recorded here as guidance.

### Reconciliation — LOCKED (two layers: BUILD + RUN)

**Decided 2026-06-19:** the model is **BUILD once (capex) + RUN monthly (MRR)** —
the revenue-maximizing, no-contradiction option. Canonical pricing now lives in
`docs/OFFER-STACK.md` ("Two layers" section):

- **BUILD (one-time):** the ladder — $1,875 → $3,750 → $7,500 → $15K → $25K →
  $35K → $45–50K → $100K — pay once to get it stood up.
- **RUN (monthly):** Operator Seat **$97/seat**, Credit Guidance Basic
  **$1,875/mo**, Mid/Fleet **$3,750/mo**, Full-Service **$7,500/mo** — pay
  monthly to keep it live + managed.

Every deal names **both** (build fee + monthly + seats). `OFFER-STACK.md` is the
single pricing authority; the table above is the operator-facing summary.

---

_Companions: `docs/OFFER-STACK.md`, `docs/LEARN-EARN-CHURN.md`,
`docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md`,
`docs/FLEET-ROSTER.md`, `docs/WATCHTOWER-ROSTER.md`._
