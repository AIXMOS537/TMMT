# AUTOPILOT — sessions that keep working after you forget them

You start a session, give it a direction, walk away, and forget it. Autopilot is the
answer to "I don't want to babysit this." It picks up the backlog and keeps making
small, correct, green commits on a timer — **no human input needed** — and it physically
can't touch anything dangerous.

There are two loops. Use either or both.

---

## 1. Maintenance loop — `scripts/autopilot.sh` (already existed)
Keeps the system healthy: sync, containment/leak check, selftest, vertical health,
memory. Silent on success; only pings you when a human is truly needed.
```bash
bash scripts/autopilot.sh install     # macOS LaunchAgent, every 3h, then forget it
```

## 2. Worker loop — `scripts/self-continue.sh` (new)
Actually **advances the backlog**. Each cycle it runs ONE safe item via headless Claude,
bound by `.aixmos/autopilot/CHARTER.md`, then **the loop verifies green and pushes**. If
the agent leaves anything red or dirty, the loop reverts it. It never touches
main/master, money, live surfaces, or gated work.

**Run it:**
```bash
bash scripts/self-continue.sh once     # one item now
bash scripts/self-continue.sh loop     # keep going every 3h (AUTOPILOT_INTERVAL)
bash scripts/self-continue.sh install  # macOS LaunchAgent — fire and forget
```

**Feed it:** drop tasks into `.aixmos/autopilot/QUEUE.md` under `## TODO`. Empty queue →
it falls back to `PLAN.md` for the next safe item. Finished items move to `## DONE`;
owner-only items get parked under `## NEEDS OWNER`.

**On the M1 (free-ish):** it uses your logged-in Claude Code (Max plan). Full unattended:
```bash
export CLAUDE_FLAGS='-p --dangerously-skip-permissions'
bash scripts/self-continue.sh install
```

## 3. Cloud loop — `.github/workflows/autopilot.yml` (runs even with every machine off)
Same worker, in GitHub Actions on a 6-hour cron. **OFF by default.** Turn on in
repo → Settings → Secrets and variables → Actions:
- Variable `AUTOPILOT_ENABLED` = `true`
- Variable `AUTOPILOT_BRANCH` = your work branch (never `main`/`master`)
- Secret `ANTHROPIC_API_KEY` = your key (your capped spend — BYO-key rule)

Merging the workflow costs nothing until you flip `AUTOPILOT_ENABLED`.

---

## The guarantees (why this is safe to forget)
- **Never leaves the branch broken.** The loop runs `tsc` + tests after the agent; red →
  auto-revert. Only green work is pushed.
- **Never touches `main`/`master`.** Refuses to run there; works on a dedicated branch.
- **Additive-only, gated=skip, no live surfaces.** Enforced by `CHARTER.md` and by not
  having credentials. Money/credit-funding/SMS/DNS/prod are off-limits.
- **One item per run.** Small, reviewable commits — never a giant unreviewable dump.
- **Kill-switch:** `touch .swarm/DARK` pauses every loop instantly. Remove it to resume.

## Where it logs
`.aixmos/autopilot/ledger.ndjson` (one line per cycle: start/shipped/reverted/noop) and
`.aixmos/autopilot/run.log` (the agent's own output). Read those to see what it did while
you were gone.
