# Bootstrap / One-Shot Audit — 2026-07-18

Audit of the semi-autonomous bootstrap + mesh scripts before they run unsupervised
across the fleet (carry Mac, M1 "Rick", brainiac). Scope: `scripts/oneshot.sh`,
`scripts/setup-mac.command`, `scripts/rick-one-shot/*`, `scripts/office-up-rick.sh`,
`scripts/autopilot.sh`, `scripts/mesh/*`.

Legend: **[FIXED]** landed in this branch · **[FLAG]** needs an owner decision, not
auto-fixed · **[NOTE]** low-severity / informational.

---

## Critical

### C1 — `oneshot.sh` "update your tools" was a silent no-op **[FIXED]**
`scripts/oneshot.sh` refreshed `scripts/ dist/ docs/ content/ config/` from
`origin/claude/team-absence-notification-0rYgo` — an ephemeral feature branch that
**no longer exists on origin** (verified with `git ls-remote`). Every checkout was
`|| true`, so the script printed `⏳ updating your tools…` and updated **nothing**,
on every machine, forever — while claiming success. Any Mac relying on `oneshot.sh`
to self-update was frozen at whatever it cloned.

**Fix:** default to `origin/master` (override with `TMMT_UPDATE_BRANCH`), verify the
ref exists after fetch, and print an honest "couldn't reach…" line instead of lying
when offline. Behavior on success is unchanged.

### C2 — Missing `m1-fleet-executor.sh` dead-ends every routed mission **[FIXED — Option A]**
**Resolved:** owner chose Option A. Built `scripts/mesh/m1-fleet-executor.sh` as a
surface-for-approval checkpoint that honors the OWNER-APPROVAL GATE:
- default `surface` shows the top-scored mission and pings the owner rail — never acts;
- `approve` **refuses without an interactive TTY** (exit 2) and requires typing the
  literal phrase `APPROVE`; on approval it only *stages* the mission to
  `FLEET-INBOX/approved/` and logs the owner-only ledger — it does **not** run any
  send/pay/sign/ship itself (the PreToolUse gate stays the backstop);
- honors the `.swarm/DARK` kill-switch; `list`/`show`/`reject`/`status` round it out.
Verified end-to-end (surface, non-interactive refusal, TTY approve/cancel, ledger).
Original finding below for the record.


`scripts/mesh/m1-work-router.sh` writes each mission to `FLEET-INBOX` ending with:

```
## Execute on M1
cd ~/projects/TMMT || cd ~/Projects/TMMT
bash scripts/mesh/m1-fleet-executor.sh
```

**`scripts/mesh/m1-fleet-executor.sh` does not exist in the repo.** So "send work to
the M1" queues missions that cannot execute — the pipeline dead-ends. This is the
direct reason work does not actually reach the M1 today.

**Not auto-fixed on purpose.** An auto-executor that acts on queued missions collides
head-on with the **OWNER-APPROVAL GATE** (CLAUDE.md, non-negotiable): anything
customer/money/legal/production-bound must terminate at owner approval. Writing an
executor that runs missions unattended would violate that rule. This needs an owner
decision on what the executor is allowed to do:
- **Option A (recommended):** executor *surfaces* the top-scored mission for approval
  and does nothing until a human says go (honors the gate, safe to auto-run).
- **Option B:** executor only runs missions explicitly tagged as
  non-gated/mechanical, and hard-refuses anything without an approval stamp.

→ **BLOCKED — needs human:** pick A or B, then I'll build it.

---

## High

### H1 — Autonomous remote-code execution on every boot **[FLAG]**
`scripts/office-up-rick.sh` (invoked by `ACTIVATE-RICK.command`, then re-run by
autopilot every 3h and at every login) automatically:
`git clone`/`git pull` **AIXMOS-AGENTS** → `npm install` → `npm start`, backgrounded,
with no pinned commit/tag and no integrity check (lines 30–38). Combined with
`sovereign-heal` reloading daemons and login-autostart, that is a lot of unpinned
remote code running with no human in the loop.

**Recommendation (owner call):** pin AIXMOS-AGENTS to a tag or reviewed commit, and/or
gate `npm start` behind a "this build was reviewed" marker. Not changed here because it
alters how the fleet self-updates — your call on the trade-off.

### H2 — Auto-discovered P0 work routes with `owner_gate=false` **[FLAG]**
`m1-work-router.sh` respects `owner_gate: true` in mission frontmatter (good — those
stay on Carry). But `route_queue_rows()` emits P0 items from the live idea queue with
`owner_gate` hard-coded to `"false"` (line ~139). So the highest-urgency,
autonomously-scraped work is precisely what bypasses the gate on its way to the M1
executor. Pairs badly with C2/H1.

**Recommendation:** default queue-sourced missions to `owner_gate=true`, or require an
explicit per-row opt-out. One-line change once you confirm the intended policy.

---

## Medium / Low

### M1 — `setup-mac.command` pulls production `.env` onto any fresh Mac **[FLAG]**
Step 6 runs `vercel env pull .env --environment=production` on a brand-new machine
(chmod 600 after). That places the full production secret set on every operator laptop
that runs setup. Per CLAUDE.md data-isolation + "PII never in cloud LLM context / keep
it on the NAS tier," a fresh operator Mac arguably should not receive full prod env.
**Owner call:** scope operator machines to a reduced env, or keep prod-pull owner-only.

### L1 — `rick-sorkin-up.sh` references missing `bootstrap-rick-m1.sh` **[NOTE]**
Line 117 calls `scripts/bootstrap-rick-m1.sh`, which is absent. Guarded by `[[ -x ]]`,
so it harmlessly falls through to `office-up-rick.sh` — no crash, just a dead branch.
Cosmetic; left as-is.

### L2 — `stamp_state` uses `datetime.datetime.utcnow()` **[NOTE]**
Deprecated in Python 3.12+ but functional; wrapped in `|| true`. Cosmetic.

### L3 — Installer-file sprawl **[ADDRESSED]**
~15 `*.command` entry points exist (`EVERYTHING`, `TMMT-GO`, `TMMT-MENU`,
`setup-mac`, `ACTIVATE-RICK`, …). The failed launches at the top of this session
(`AIXMOS-ONESHOT.command`, `.txt` not found) are a symptom: no single reliable,
well-known entry point. Added **`AIXMOS-INSTALL.command`** at repo root as the one
canonical, idempotent installer — it delegates to the maintained scripts, duplicates
no logic, and defaults to a safe "setup only" role when run unattended.

---

## Verified healthy
- Owner-approval PreToolUse hook present and intact: `.claude/hooks/owner-approval-gate.py`.
- `install-oneshot-bin.sh` PATH edits are idempotent (guarded on `TMMT_LOCAL_BIN`).
- LaunchAgent installers (`autopilot`, `install-launchagent`) unload-before-load and
  are re-runnable; autopilot honors the `.swarm/DARK` kill-switch.
- All other referenced scripts resolve (`swarm-join`, `hailmary`, `containment`,
  `selftest`, `sync-machine`, `mesh/link`, `mesh/notify-owner`, …).

## Fixed in this branch
- **C1** — `scripts/oneshot.sh` now updates from `origin/master` and reports honestly.
- **C2** — `scripts/mesh/m1-fleet-executor.sh` built (Option A, surface-for-approval);
  "send work to the M1" now completes instead of dead-ending.
- **L3** — `AIXMOS-INSTALL.command` added as the single canonical installer.

## Needs an owner decision (nothing auto-applied)
- **H1** — pin/verify the AIXMOS-AGENTS auto-`npm start`.
- **H2** — gate policy for queue-sourced P0 missions.
- **M1** — whether operator Macs get full production `.env`.
