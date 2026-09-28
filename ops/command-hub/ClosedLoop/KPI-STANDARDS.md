# TMMT Closed-Loop KPI Standards

The rule: this tablet runs the operation on a **closed loop** — it only trusts and works
with devices on the Tailscale mesh. Every cycle is graded against these KPIs. A cycle
that misses a KPI shows RED on the scoreboard so it gets fixed, not ignored.

## The loop (one cycle = one run of closed-loop-check.ps1)

1. **Sense** — read live Tailscale mesh state + local services.
2. **Grade** — compare every reading against the KPI thresholds below.
3. **Report** — write SCOREBOARD.md (latest) + append history (JSONL).
4. **Act** — anything RED is the first item on the next work block.

## KPI thresholds

| # | KPI | Standard (GREEN) | RED when |
|---|-----|------------------|----------|
| 1 | Mesh core online | `fleet` reachable + at least 1 of `brainiac-7` / `watchtower` / `tmmts-macbook-pro` | fleet down, or all secondaries down |
| 2 | Mesh latency | Median ping to online peers < 150 ms | ≥ 150 ms or unreachable |
| 3 | Local AI (Ollama) | `localhost:11434` answers in < 3 s | no answer |
| 4 | Mission Control intact | `TMMT-MISSION-CONTROL.ps1` present | missing |
| 5 | WorkSync armed | `TMMT-WorkSync-USB` task state = Ready/Running | disabled or missing |
| 6 | Disk headroom | ≥ 15% free on C: | < 15% |
| 7 | RAM headroom | ≥ 1.5 GB free | < 1.5 GB |
| 8 | Cycle time | Full check completes < 60 s | ≥ 60 s |
| 9 | Crimson Shadow | `127.0.0.1:8770` answers in < 3 s, **or** the task is disabled | task enabled but port silent |

### Why KPI 9 probes the port and ignores the task's state

Added 2026-08-25. Crimson Shadow cannot be graded the way KPI 5 grades WorkSync:

- **Task state is not evidence.** `CrimsonShadow-AtBoot` read `State = Ready` for
  five days while nothing was listening on 8770. A state check scores that GREEN.
- **The last result is not evidence either.** A persistent server that gets
  stopped exits `267014` (`SCHED_S_TASK_TERMINATED`). That is the normal exit for
  a service being shut down, not a fault — grading on it produces false RED.
- **Process matching is blind.** A task-launched `pythonw` reports an *empty*
  CommandLine to `Win32_Process`, so you cannot identify it by its script path.
  (Same finding that put the port-holder fallback into the `TMMT kill` verb.)

That leaves the live port as the only honest signal. One exception is folded in:
`TMMT kill` disables the task on purpose, so *task disabled* is read as a
deliberate stop and stays GREEN. The single RED condition is **task enabled but
port silent** — armed and supposed to be running, yet not answering.

## Closed-loop boundary

- Work product moves only between mesh devices (Tailscale 100.x addresses) and
  approved local folders (`CommandCenter`, `TMMT*`, `Brain`, `Sync`).
- The private brain (family/personal lanes) never leaves this device toward
  work-facing peers — same separation rule as home-bot.
- Optional hard lockdown (Windows Firewall rule allowing only the Tailscale
  interface for inbound) is documented but **not applied automatically** —
  operator's call.

## Files

- `closed-loop-check.ps1` — runs one cycle.
- `SCOREBOARD.md` — latest graded scoreboard (overwritten each cycle).
- `logs\closed-loop.jsonl` — full history, one JSON line per cycle.
- Scheduled task `TMMT-ClosedLoop` — runs a cycle at logon and every hour.
