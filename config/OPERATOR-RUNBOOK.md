# Operator Runbook — run the business with minimal backstops

> Everything you need to run day-to-day. Agents do the work, the gate decides
> what's real, and **you stay the approval layer for only the few things that can
> actually hurt you.** Those few things are the *minimal backstops* — §2. Run the
> whole thing from one CLI — §3.
>
> Local-first. Nothing here pushes or publishes on its own.

_Compiled June 15 2026._

---

## 1. The operating loop (what runs, by whom)

```
 request (client / owner / employee)
   → agent or tool drafts it ON A BRANCH
   → verify-gate (build/types/lint/tests/integration) — GREEN ONLY proceeds
   → local model fixes anything red; frontier only on escalation
   → mesh handoff to the right node (acceptance: gate green)
   → ►► OWNER APPROVAL ◄◄  to merge / deploy / act outward   ← a backstop
   → done. audited.
```

Agents handle ~90% (intake, triage, drafts, fixes, follow-ups). You touch the 10%
that's judgment or risk. That's the whole point: you scale, you don't firefight.

## 2. Minimal backstops — the ONLY human checkpoints (keep these, automate the rest)

These are irreducible. Everything *not* on this list should be automated/agent-run.

| # | Backstop | Why it stays human | Where |
|---|---|---|---|
| 1 | **Approve merge to `master` / production deploy** | One bad deploy hits real customers | gate green + your OK |
| 2 | **Approve irreversible / outward actions** — send real msgs/SMS/email, delete data or projects, rotate/issue secrets, transfer ownership | Can't be undone; reputational/legal | `MESH-COORDINATION.md §4` |
| 3 | **Offboard same-day + rotate secrets** when someone leaves | Standing access = the top risk | `IT-SUPPORT-TEAM-PLAYBOOK.md §8` |
| 4 | **Review a gate escalation** (verify-gate handed you a red it couldn't fix) | Novel/hard problem needs a human | `.aixmos/proposed.patch` + logs |
| 5 | **Compliance go/no-go** — credit-repair pricing (CROA), equity offers (securities), monitoring consent | Legal exposure | Master File §7 FLAGS |

If a decision isn't one of these five, an agent or the gate can own it. That's
"minimal backstops."

## 3. Your command surface (one CLI, all local)

```bash
alias aixmos='bash scripts/aixmos.sh'   # add to ~/.zshrc / ~/.bashrc

aixmos doctor      # health-check: tools, scripts, router, hook, what's missing
aixmos brief       # morning glance: branch, uncommitted, open handoffs, last verify
aixmos verify --apply        # fact-check a change; local model fixes red
aixmos handoff --from FORGE --to CLOUD --intent "…" --slug x   # send work to a node
aixmos legacy --apply --build --git   # build the backend-less handoff edition
aixmos hooks       # install the pre-push gate (nothing leaves a machine red)
```

## 4. Daily cadence

- **Morning:** `aixmos brief` → clear your handoff inbox, glance at last verify + commits.
- **All day:** every change goes branch → `aixmos verify` → green. Agents draft client/
  employee replies; you approve the outward ones (backstop #2).
- **Shift change (PK/PH/you):** outgoing region emits `aixmos handoff …` so the next
  region wakes with full context (`MESH-COORDINATION.md §5`).
- **End of day:** anything green + approved gets merged; the rest stays on branches.

## 5. Weekly cadence

- **Access review:** confirm least-privilege still holds; revoke stale; rotate on schedule.
- **Incident/SLA review:** what broke, what the gate caught, what to automate next.
- **Automate the top repeat:** turn the #1 recurring manual task into a runbook/agent.
- **Update docs/runbooks** so agents execute more, you decide less.

## 6. First-time setup (on each machine — can't be done from cloud)

1. `aixmos doctor` — see what's missing.
2. Stand up the **LiteLLM router** + pull local models (`LOCAL-FIRST-AI-STACK.md §9`),
   then `export LITELLM_BASE=http://<hub-tailnet-ip>:4000/v1`.
3. `aixmos hooks` — wire the pre-push gate.
4. Join **Tailscale**; apply the **ACL** (`infra/tailscale-acl.jsonc`) in the admin.
5. Build the device **Shortcuts** (`DEVICE-SYNC-PRIVATELLM.md`).

## 7. If something breaks (degrade gracefully)

- **Router down:** `aixmos verify` still runs the checks (report-only) — you just
  lose the auto-fix until it's back. Work continues.
- **A node offline:** handoffs queue on git branches; picked up when it returns.
- **Gate can't fix it:** read `.aixmos/check-*.log` + `.aixmos/proposed.patch`; that's
  backstop #4 — your call.
- **Emergency push past the gate:** `git push --no-verify` (use rarely; it's logged).

---

_The whole system map: `docs/AIXMOS-SYSTEM-INDEX.md`. Source of truth for strategy:
the AIXMOS Master File on the NAS `/AIXMOS/master/`._
