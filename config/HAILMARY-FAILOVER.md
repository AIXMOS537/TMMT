# HAILMARY Failover & the Two-Node GPS Protocol

Resilience for when things break — a crashing PC, a power blip, or **you going
dark** across every channel. Built around one hard lesson and one trusted node.

## The lesson: Brainiac (Windows) is unreliable
The **Brainiac Windows PC kept crashing.** So it is **NOT** the single point of
failure for the brain or the agent. (This supersedes any "Brainiac is the sole
always-on host" framing in `docs/MEMORY-MESH-ACCESS.md` / `docs/SOVEREIGN-STACK.md`.)

## The trusted node: the home M1 MacBook Pro Max (32 GB)
Your most-trusted machine — **plugged in, always on, on Tailscale** — is the
**primary always-on / failover node** and the **EXECUTOR** ("little brother").
It runs local AI (Ollama), holds a synced copy of the brain's reach, and can act
on your behalf when you're unreachable. macOS is stable; this is the reliable
anchor Brainiac couldn't be.

Set it up:
```bash
bash scripts/hailmary-setup.sh --role home \
  --brain-url https://<brain>.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
```
Then: keep it **plugged in**, **never sleep on power** (Settings → Battery/Lock
Screen), and on the **tailnet**. It gets the memory MCP + the iMessage bridge.

## The two-node GPS protocol (Navigator ↔ Executor)
A two-person job where each understands the other and speaks plain English:

- **NAVIGATOR = HAILMARY (the lead).** It has *already been to the destination* —
  it knows the route. It gives the executor **one clear next step at a time**, in
  simple English, no fluff. Personas: `HAILMARY_NAVIGATOR_SYSTEM`.
- **EXECUTOR = the home M1 Mac (the little brother).** It does **exactly that one
  step**, then **reports back in plain English** (did it / result / what's
  blocking) and asks for the next. Persona: `HAILMARY_EXECUTOR_SYSTEM`.

```
You go dark (no reply on personal OR work channels in working hours)
        │
NAVIGATOR (HAILMARY): "Step 1: do X."   ──►  EXECUTOR (home M1): does X
        ▲                                          │
        └──  "Done. Result: Y. Blocked on Z?"  ◄───┘
NAVIGATOR re-routes: "Then Step 2: …"   (repeat until the job is done)
```
Both translate everything into broken-down, simple-English context — interpret
what the other means, strip the fluff, get the task/assignment **done**.

### When the executor is allowed to act
Only when the owner is **unreachable across personal + work channels**. Even
then:
- **Never** the personal line (+1 571-351-9690); reach the owner on the **work
  cell** ([phone removed]) only in working hours.
- Nothing **risky or irreversible** without explicit navigator confirmation.
- Every action is written to the shared brain (full audit trail).

## Resilience runbook (crisis / outage)
| Event | What auto-happens | What you do |
|---|---|---|
| **Brainiac crashes** | Home M1 keeps the brain reachable + executor running | nothing; it's the failover |
| **Power outage** | Put the home M1 + router on a **UPS** → it rides through on battery + cell hotspot/Tailscale | confirm UPS + hotspot once |
| **Cloud/API down or out of credits** | Local Ollama serves AI; self-host (Coolify) serves the app — no cloud needed | nothing |
| **You go dark** | Navigator drives the executor through queued work; escalations wait on the work cell (in hours) | reply when able |
| **A node dies** | The others share the one brain — no data lost (write on one, read on another) | re-image later |

## Hardening checklist (make it bulletproof)
- [ ] Home M1: plugged in, sleep disabled, on Tailscale, `--role home` done.
- [ ] **UPS** for the home M1 + router (rides out power blips).
- [ ] Ollama installed on the home M1 (local AI; no token dependence).
- [ ] Brain reachable over Tailscale from the home M1 (it can be the host).
- [ ] NAS backups / Supabase PITR on (no data loss).
- [ ] Second synced node (carry Mac) so there's never a single point of failure.
- [ ] Demote Brainiac to "nice-to-have," not critical path.
