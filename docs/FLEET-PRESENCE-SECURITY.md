# Fleet Presence & Security — know it's clean, know it's alive

> Two jobs: **(1)** prove every machine that ever touched this code is clean of
> backdoors, and **(2)** know — to the millisecond — when any device is online.
> The second is the dispatch backbone for **Operation Overdrive** (presence that
> can later feed super/hypercar dispatch).
>
> Honest framing: security is **continuous**, not a one-time scrub. These tools
> *detect* and *monitor*; they don't make anything "forever safe." Pair them with
> key rotation (`docs/SECRET-ROTATION.md`) and least-privilege (`infra/tailscale-acl.jsonc`).

---

## 1. Online audit — already done (clean)

A live audit of your GitHub (`AIXMOS537/TMMT`) on 2026-06-16 found:
- **Access: only you** — one collaborator, `AIXMOS537` (admin). No outside access.
- **Automation: one workflow** (`mission-daily`) — your own cron; POSTs to your own
  `tmmt-ops.vercel.app` with a GitHub-encrypted secret. **No exfiltration.**
- **Commit authors: only "Muhammad Taha" and "Claude"** (your sessions). No stranger pushed.

→ At the access level that matters, **no backdoor into your code.** Re-run anytime
with the GitHub MCP audit (collaborators, workflows, commit authors).

## 2. Per-device integrity scan — is THIS machine clean?

Run on every machine that ever touched the code (carry Mac, work Mac, brainiac,
operator TRAPTOPs):

```bash
aixmos integrity      # or: bash scripts/device-integrity.sh
```
Read-only. Flags the common footholds for review (it never deletes):
- **SSH `authorized_keys`** — who can log in as you (shows fingerprints, not keys).
- **Persistence** — launch agents/daemons (mac) or cron/systemd (linux) running
  from `/tmp`, `curl|sh`, base64, `nc`, etc.
- **Shell rc** — fetch-and-run / reverse-shell patterns in `.zshrc`/`.bashrc`.
- **Listening ports** — who can reach in.
- **`/etc/hosts`** — redirects to fake sites.
- **Git remotes** — flags any remote that isn't your `AIXMOS537` GitHub.

Anything flagged → review the report in `.aixmos/integrity-<host>-<time>.txt`. Run it
on a schedule (launchd/systemd) so drift gets caught.

## 3. Heartbeat / last-ping — know it's alive

```bash
aixmos beat           # record THIS device's heartbeat now (millisecond stamp)
aixmos presence       # board: every device ● ONLINE / ○ offline + last-seen age
bash scripts/heartbeat.sh watch   # beat every 5s (run as a background service)
```
- **Sub-second resolution** — `presence` shows "last 162ms ago" for live nodes.
- **Whole-fleet view:** set `HEARTBEAT_DIR` to a **shared path** every node can write
  to — a NAS share or a Tailscale-mounted dir. Each device writes `<host>.beat`;
  `presence` reads them all. Optionally set `HEARTBEAT_SUPABASE_URL/KEY` to also
  stream beats to Supabase for a live web board.
- **Always-on:** run `heartbeat.sh watch` from launchd (mac) / systemd (linux) so a
  device reports continuously while powered.

### Operation Overdrive (later)
This presence layer is the dispatch substrate: a registry of which nodes (and, in
time, which vehicles) are alive, where, and how recently. Build the dispatch logic
on top of this last-seen board when that phase starts — don't put it in cars until
the presence + security layers are proven on the laptops.

## 4. The integration stack ("best of all worlds")

You already have the integration thesis documented — don't re-pick tools, *route*
them: `docs/LOCAL-FIRST-AI-STACK.md` (models + LiteLLM router across Claude/Cursor/
Codex/Ollama), `docs/VERIFICATION-MESH.md` (every tool's output fact-checked before
trust), `docs/AIXMOS-PLATFORM-BLUEPRINT.md` (any tool/business as config). New tools
plug in behind the router + the gate, or they don't ship.

## 5. The honest limits

- I can't scan a machine I have no connection to — these tools run **on** each device
  (you or HAILMARY run them). The cloud session can only audit online services (GitHub/Vercel).
- No tool makes you "forever safe." Clean = rotate keys, run these scans on a schedule,
  keep access least-privilege, and watch the presence board. That's how you *stay* clean.

---

_Tools: `scripts/device-integrity.sh`, `scripts/heartbeat.sh` (via `aixmos integrity`
/ `aixmos presence` / `aixmos beat`). See `docs/SECRET-ROTATION.md`,
`infra/tailscale-acl.jsonc`, `docs/MESH-COORDINATION.md`._
