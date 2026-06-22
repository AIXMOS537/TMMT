# AIXMOS System Index — the whole build, in one map

> One place that ties together everything built for the local-first, agents-first,
> all-in-one operation. Start here; each row links to the doc/script that runs it.
>
> Status: **local-first, no external publish.** All work lives on branch
> `claude/team-absence-notification-0rYgo` (not merged / no PR yet, by choice).

_Compiled June 15 2026._

---

## 1. The system in one picture

```
                         ┌─────────────────────────────────────────────┐
   any AI tool ─────────►│  VERIFICATION MESH  (local fact-check gate)  │
 Claude/Cursor/Codex     │  deterministic checks = truth; local model   │
   teammates/agents      │  fills blanks; frontier only on escalation   │
                         └───────────────┬─────────────────────────────┘
                                         │ accepted (green) only
                                         ▼
   ┌────────────── AGENT MESH (CARRY / FORGE / BRAIN / CLOUD) ──────────────┐
   │  git bus + Slack ping + handoff cards; owner-approval guardrails        │
   └───────────────┬───────────────────────────────────────┬───────────────┘
                   │                                        │
        LOCAL-FIRST AI STACK                        ALL-IN-ONE PLATFORM
   (LiteLLM router → local models;                (business = a registry entry,
    Claude only on escalation)                     any industry; agents run it)
                   │                                        │
            DEVICE SYNC (4 Apple devices over the tailnet, Private LLM)
                   │
            OFFSHORE IT/SUPPORT (least-privilege, Tailscale ACL)
                   │
            PROJECTAIXMOS LEGACY (backend-less handoff edition)
```

## 0. Above everything — the Constitution
**`docs/AIXMOS-CONSTITUTION.md`** is the top of the house: the why, the law, the line.
Mission · two editions (HAILMARY private / AIXMOS public) · ethical line · Law of
Loyalty · security mandate · roles & comms. Every component below serves it.
Conduct bar: **`docs/OPERATOR-STANDARDS.md`**.

## 2. Components (docs + runnable scripts)

| # | Component | What it does | Files |
|---|---|---|---|
| 1 | **Verification Mesh** | Local fact-check gate across every AI tool; auto-fix loop, escalation, audit | `docs/VERIFICATION-MESH.md` · `scripts/verify-gate.sh` |
| 2 | **Local-First AI Stack** | Run most work on local models via a router; Claude on escalation. Model/quant picks (June 2026) | `docs/LOCAL-FIRST-AI-STACK.md` |
| 3 | **Agent Mesh** | CARRY/FORGE/BRAIN/CLOUD coordinate over the git bus; handoff protocol + guardrails | `docs/MESH-COORDINATION.md` · `scripts/mesh-handoff.sh` |
| 4 | **Device Sync** | 4 Apple devices in sync via tailnet + Private LLM + Shortcuts (across Apple IDs) | `docs/DEVICE-SYNC-PRIVATELLM.md` |
| 5 | **Offshore IT/Support** | Run backend support from PK/PH safely; least-privilege + enforceable network ACL | `docs/IT-SUPPORT-TEAM-PLAYBOOK.md` · `infra/tailscale-acl.jsonc` |
| 6 | **All-in-One Platform** | Any business/industry as a config, not a fork; agents-first operating model | `docs/AIXMOS-PLATFORM-BLUEPRINT.md` · `src/lib/business-lines/registry.ts` |
| 7 | **ProjectAixmos Legacy** | Backend-less, managed-cloud-only edition for handoff (mod legacy) | `docs/PROJECTAIXMOS-LEGACY-SPLIT.md` · `scripts/build-projectaixmos-legacy.sh` |
| 8 | **Flash-Deploy & Cleanup** | Go-live + cleanup runbook tagged by who/where runs each step | `docs/FLASH-DEPLOY-RUNBOOK.md` |
| 9 | **People Ops — Onboarding** | Mission-gated, plug-and-play onboarding for any device (Mac/Win/Linux) | `dist/onboard.command` · `dist/onboard.bat` · `dist/onboard.ps1` · `scripts/onboard-tonight.sh` |
| 10 | **People Ops — Grant** | Owner's one-tap GRANT; nobody in without YES; scoped, DEV-first, revocable | `scripts/grant.sh` |
| 11 | **Operator Standards** | The permanent conduct bar (phone rule, take-off-plate, honesty); agreed at onboarding | `docs/OPERATOR-STANDARDS.md` · `dist/standards-picture.svg` |
| 12 | **Operator Kits** | Role kits — Red Hood (credit/funding), Setter (AIXMOS), Moe (ProjectAixmos) | `docs/kits/*` · `scripts/check-my-ad.sh` · `content/consumer-facing/*` |
| 13 | **Account Security** | Discover all accounts (browsers, no passwords) + 1-by-1 hardening tracker | `scripts/account-discover.sh` · `scripts/account-hardening.sh` |
| 14 | **Confidentiality & Lock** | How/why owner-only; LOCKED until owner unlock; client data sovereignty | `docs/CONFIDENTIALITY-AND-LOCK.md` · `docs/DATA-ACCESS-CHARTER.md` |
| 15 | **Compliance** | Credit/funding guardrail — blocks illegal claims before they reach anyone | `docs/CREDIT-FUNDING-COMPLIANCE.md` · `config/credit-compliance.json` |
| 16 | **Control Boards** | One-word boards: owner `tmmt`, Moe `moe`, setter `setter` | `scripts/oneshot.sh` · `scripts/moe-oneshot.sh` · `scripts/setter-oneshot.sh` |

## 3. The runnable scripts (all local, all dry-run-safe)

| Script | One command |
|---|---|
| Your control board (one word) | `bash scripts/oneshot.sh` → alias `tmmt` |
| Onboard anyone (any device) | send `dist/onboard.command` (Mac) / `dist/onboard.bat` (Win) |
| Grant an onboarded person | `bash scripts/grant.sh <their-card.txt>` → type YES |
| Secure your accounts | `bash scripts/account-discover.sh --merge` → `account-hardening.sh top` |
| Check an ad is legal | `bash scripts/check-my-ad.sh my-ad.txt` |
| Verify any change before trusting it | `scripts/verify-gate.sh --apply` |
| Build the backend-less Legacy edition | `scripts/build-projectaixmos-legacy.sh --apply --git` |

All **dry-run/owner-gated by default, never push, audited.**

## 4. How a request flows end-to-end

1. **Client / owner / employee** asks for a change.
2. Any AI tool (or a mesh node) makes it **on a branch**.
3. **`verify-gate.sh`** runs — build/types/lint/tests/integration. Red → local model
   fixes → re-verify. Only **green** proceeds.
4. Mesh **handoff** card carries it to the right node; `acceptance: gate green`.
5. **Owner approval** to merge to `master` (and to do anything irreversible/outward).
6. Local models do ~90%; frontier only on the hard 5% — fast, private, cheap.

## 5. Operating principles (the through-line)

- **Local-first.** Private by default; escalate by exception.
- **Checks are truth.** No AI self-certifies; the gate decides.
- **Agents-first.** People are the approval layer, not the labor layer.
- **Config, not forks.** New business/industry = a registry entry + a tenant.
- **Least privilege.** The network (tailnet ACL) enforces what trust shouldn't.
- **Everything auditable.** Branches, handoff cards, `.aixmos/verify-log.ndjson`.

## 6. State & next steps

- **Branch:** `claude/team-absence-notification-0rYgo` — all components committed,
  **kept local** (no PR / not merged) per current direction.
- **On your machines (can't be done from cloud):** stand up the LiteLLM router,
  pull local models, wire `verify-gate.sh` as a pre-push hook, apply the Tailscale
  ACL, build the device Shortcuts.
- **When ready:** say the word to open a PR (review/merge from phone) or emit the
  machine-side steps as mesh handoffs.

---

_Single source of truth for the AIXMOS Master File lives on the NAS `/AIXMOS/master/`;
this index maps the repo-side build that supports it._
