# MASTER BRIEF — the X Empire (living source of truth)

> **Owner-only. Living doc — kept current, not a dated snapshot.** Last updated **2026-07-04**.
> The one place everything decided lives. Your live one-liner is `NEXT.md`; this is the
> full record behind it. Auto-loaded canon: `CLAUDE.md`.

---

## 0. Operating mode (2026-07-04) — X → full orchestrator
Taha steps back from operational grind. The **brain + Rick Sorkin + the agent army** run
**all non-gated work autonomously**. The **owner-approval gate is the sole human checkpoint
and stays X's**: send money / sign / message customers / ship to prod / flip a legal gate
still need X's one-tap yes (pre-drafted). The gate is never disabled; no agent self-approves.

---

## 1. Company map (locked)

| Entity | What it is | Owner |
|---|---|---|
| **AIXMOS** | The GHL **agency** account (All In One Management LLC). The engine + IP. | Muhammad Taha (X) |
| **TMMT Rentals** | A **sub-account**. Separate automotive company. | Muhammad Taha (X) |
| **Moe Legacy** | Credit repair + business funding company — **FROZEN until paid** (see §4). | Muhammad Umar / Moe |
| **HAILMARY / Project X** | The owner-only control brain. Never customer-facing. | X |
| **Rick Sorkin** | The assistant. Face = DREAMA/AIXMOS; brain = Project X; **master = X**. | X (licensable) |

**Rule above all rules:** partners/public only ever meet the **face**. The brain and the
keys are X's. Whoever drives, X owns the title.

---

## 2. Chain of command (roster: `docs/WATCHTOWER-ROSTER.md`)
- **The Boss = X (Muhammad Taha)** — master; gates, break-glass, IP, kill-switch.
- **🦅 Nightwing = Aayan Khan** — first lieutenant, now **holds the controls under X**.
  Contact `aayan@khanstrategies.com`; platform login `aayan.khan.6449@gmail.com`.
  **Granted `tenant_admin` of Khan Strategies LLC (2026-07-04)** — fenced to his org.
- **🐦‍⬛ Red Hood = Umar / Moe Legacy** — **frozen** (see §4).

---

## 3. Rick Sorkin — BUILT and runnable (`docs/RICK-SORKIN.md`, `scripts/rick`)
The assistant is real code, not a spec. Two states of the same tool:
- **For X, now:** runs on the owner's Mac (Apple Silicon), local-first on Ollama
  (`qwen2.5:14b`). One command: `bash scripts/rick-up` → installs, serves, pulls, wakes.
  Then `bash scripts/rick chat` / `brief` / `remember` / `recall` / `doctor`.
- **For Moe (partner-facing deployment):** **paused** with Moe's freeze; lights up on payment.

**Enforced in code:** owner gate (money/sign/customer/prod/legal → drafted + queued to
`~/.rick/approvals-queue.md`, never executed), X's DARK kill-switch, owner-local memory
(gitignored). Self-verifies with `rick doctor` (passes green, no live model needed).

---

## 4. Moe Legacy — corrected scope + freeze
- Moe **already operates** credit repair on **MyFreeScoreNow + DisputeFox** (his licensed
  lane). **We integrate his vendors — we do NOT rebuild a dispute engine.**
- What Taha builds for Moe = the **agency layer** (`workstream-3`: lead pool +
  students/operators + commission engine) + **Rick Sorkin**.
- **FROZEN until paid (Supabase `suspended_at` on org `bbbb…bbbb`, reversible).** All Moe
  work paused; clear the freeze on payment.

---

## 5. Leash → graduation (`docs/AIXMOS-LICENSE-AND-TOKENS.md`)
X holds master keys / kill-switch / owner-gate until **$50K real USD collected** (via TMMT
tokens) for engine use; then the partner graduates to a full **white-label LICENSE** (takes
marketing credit) — **IP + kill-switch stay X's. License, not sale.**

---

## 6. Also built this session
- **Owner Voice Vault** (`docs/OWNER-VOICE-VAULT.md`, `owner-voice/` gitignored) — private
  DRAFT→HELD→RELEASED room for Taha's voice; per-piece owner gate.
- **Pioneer marketing** (`docs/marketing/PIONEER-POSITIONING.md`) — "Credit. Capital. Cars.
  One engine." DRAFT; owner-approval before any publish.

---

## 7. Tripwires being guarded (protect-X)
1. 🔒 **TMMT tokens = closed-loop usage credits** — never cashable/transferable/"invest" (else MTL/securities).
2. 🔒 **White-label = license, not sale** — partner takes marketing credit; X keeps IP + kill-switch.
3. ⚖️ **Commissions on real collected client services** — never recruitment/"staying on" (anti-pyramid).
4. ⚖️ **Credit = "guidance,"** never "repair," in AIXMOS copy; actual repair stays in DisputeFox.
5. 🔐 **CROA/VDACS gates** (`shared/compliance-gates`) all `false`, VA-only; CPN/rented-tradeline block TRUE forever.
6. 🧹 **Handoff hygiene** — the rental builder over-ships; any partner bundle needs an allowlist rebuild + leak-check first.

---

## 8. Open — the only things that need X's tap
- [ ] Wake Rick on the M1: `cd ~/Projects/TMMT && git pull && bash scripts/rick-up`
- [ ] Send Aayan his login / "you're the lieutenant" (or delegate to route approvals to him)
- [ ] Review the pioneer positioning draft → approve/edit
- [ ] Merge PR #129 when ready

_Everything else is committed, tested, and held. X carries none of it._
