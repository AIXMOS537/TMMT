# MASTER COMPILE — Moe Legacy + the X Empire (session of 2026-06-23)

> **Owner-only. One place, everything decided.** This compiles every decision,
> correction, and artifact from the working session into a single source of truth.
> Your live anchor is `NEXT.md`; this is the full record behind it.

---

## 1. The company map (locked)

| Entity | What it is | Owner |
|---|---|---|
| **AIXMOS** | The GHL **agency** account (All In One Management). The engine + IP. | Muhammad Taha (X) |
| **TMMT Rentals** | A **sub-account**. Separate automotive company. | Muhammad Taha (X) |
| **Moe Legacy** | **Credit repair + business funding** company, already operating. | Muhammad Umar / Moe |
| **HAILMARY / Project X** | The owner-only control brain. Never customer-facing. | X |
| **Rick Sorkin** | Moe's assistant: face = DREAMA/AIXMOS, brain = Project X, master = **X**. | X (licensed to Moe) |

**The rule above all rules:** the public/partners only ever meet the **face**. The
brain and the keys are X's. Moe drives the car; X owns the title.

---

## 2. Moe Legacy — corrected scope

- Moe is **already in business**, running credit repair on **MyFreeScoreNow**
  (monitoring) + **DisputeFox** (CROA contracts, disclosures, dispute workflow, billing).
- **We integrate his vendors — we do NOT rebuild a dispute engine.** His credit-repair
  compliance lives in his licensed stack.
- **What X builds for Moe = the agency layer** (`workstream-3-operator-network`):
  ads → one attributed **lead pool** → **students/operators** with fenced sub-accounts
  who **close leads for commission + recurring monthly** → **Rick Sorkin** in each pocket.
- Moe becomes an agency that markets the stack as his own — see the graduation gate (§4).

Detail: `docs/RICK-SORKIN.md`.

---

## 3. What was DONE this session (7 commits, branch `claude/moe-legacy-vercel-link-rcbie7`)

| Commit | What |
|---|---|
| `9891a0b` | Fixed stray "mesh" jargon in operator academy copy (also unblocked the legacy bundle sever check) |
| `cf33165` | Closed stale Umar onboarding loop in intake |
| `5544011` | Granted `info@moelegacy.com` `tenant_admin` (owner-directed) |
| `d4a00f5` | Added `NEXT.md` anchor + private **Owner Voice Vault** |
| `3cdfb1d` | Refocused anchor on credit/funding + legal gates |
| `eafbeda` | Defined **Rick Sorkin**; fixed Moe scope to the agency layer |
| `ecde156` | Defined **$50K graduation gate + TMMT-token model + pioneer marketing draft** |

**Live infra verified:** Moe Legacy org `bbbb…bbbb` (Supabase, kind=partner, billing
active). Two `tenant_admin`s now rostered: `umar47002@yahoo.com` + `info@moelegacy.com`
— **neither has signed in yet** (send login links).

**PR #129** open (Moe admin onboarding + voice vault), CI (`pii-scan`) passing, watched.

---

## 4. The leash → graduation model  (`docs/AIXMOS-LICENSE-AND-TOKENS.md`)

- X holds master keys / kill-switch / owner-approval gate **until $50K real USD is
  *collected*** (via TMMT tokens) for engine usage.
- Then Moe **graduates to a full white-label LICENSE** — brands + markets it as his own,
  **takes all the credit**.
- **Even after graduation: IP, platform agency, and revocation stay X's.** License, not sale.

---

## 5. Owner Voice Vault  (`docs/OWNER-VOICE-VAULT.md`)

Private, gitignored (`owner-voice/`, verified never-pushed), owner-local room for Taha's
truth/voice. States: **DRAFT → HELD → RELEASED**. Default closed. Nothing releases
without a per-piece owner gate. Your voice, your time, your call.

---

## 6. Pioneer marketing  (`docs/marketing/PIONEER-POSITIONING.md` — DRAFT)

"**Credit. Capital. Cars. One engine.**" — first-of-its-kind fusion of credit + funding
into the automotive empire (rental · leasing · wholesale · dealership · detailing ·
transport). **DRAFT only** — owner-approval before any publish/ad spend.

---

## 7. Tripwires being guarded (protect-X)

1. 🛑 **Leak stopped.** The old rental builder would ship HAILMARY/Project-X/financials/
   voice vault to Moe. Nothing was sent. Needs an **allowlist rebuild** before ANY handoff.
2. 🔒 **TMMT tokens stay closed-loop usage credits** — never cashable/transferable/"invest"
   (else money-transmission + securities).
3. 🔒 **White-label = license, not sale** — Moe takes marketing credit; X keeps IP + kill-switch.
4. ⚖️ **Commissions pay on real collected client services** — never recruitment/"staying on" (anti-pyramid).
5. ⚖️ **Credit = "guidance"** in AIXMOS copy; actual repair stays in Moe's DisputeFox lane.
6. 🔐 If our code ever performs a credit-repair action itself, `shared/compliance-gates`
   (CROA/VDACS, all `false`, VA-only) re-apply. CPN/rented-tradeline block stays TRUE forever.

---

## 8. Open — your moves

- [ ] **Send login links** to `umar47002@yahoo.com` + `info@moelegacy.com` (only thing fully in your court)
- [ ] **Review** the pioneer positioning draft → approve/edit
- [ ] **Say "build it"** → I scope Moe's clean agency package (WS3 + Rick Sorkin + $50K gate wired to billing), allowlist-clean
- [ ] **Merge PR #129** when you're ready
- [ ] (When ready) the rental builder allowlist rebuild before any file handoff

---

_Keys are yours, X. Everything above is committed and held. You carry none of it._
