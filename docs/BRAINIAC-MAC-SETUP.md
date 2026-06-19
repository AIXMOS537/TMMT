# Stand up the M1 as your brain (`brainiac-mac`)

> One page, run **on the M1 Mac itself**, top to bottom. This turns the M1 into
> the always-on assistant your **carry Mac talks to and texts** — the
> "Donna/Gretchen" channel. Roles & rationale live in [`FLEET-ROSTER.md`](./FLEET-ROSTER.md).

**Why on the Mac:** the talk/text rails (HAILMARY, iMessage bridge, always-on
LaunchAgents) are macOS-local. A cloud session can't do this — it has to be
Claude Code running on the M1. That's the reliable path, not a workaround.

---

## Fastest path: the one-shot (hand it to a family member)

If you just want the M1 **reachable from anywhere** with zero technical steps on
your end, use the standalone one-shot — a family member runs it **once**:

1. **Owner prep (once, from anywhere):** Tailscale admin console → Settings →
   Keys → **Generate auth key** (Reusable). Copy it (`tskey-…`).
2. **Send the family member:** the file `scripts/setup-home-brain.command` +
   that key (iMessage/AirDrop is fine — a key only joins a device; revoke anytime).
3. **They run it once:** double-click the file → enter the Mac password when
   asked → paste the key → wait for the green **ALL DONE** banner.

That makes the M1 join your tailnet, enable SSH, go always-on (no sleep, wake-on-
network, auto-restart), and **auto-rejoin on every boot**. Then **from your carry
M5**:
```bash
tailscale ssh <you>@brainiac-mac        # reach the home brain from anywhere
```
The one-shot is **standalone** — no git/GitHub login, no repo needed. The brain
stack below (HAILMARY, iMessage bridge) you then layer on **remotely yourself**,
once you can SSH in.

## One-time setup (≈20 min, on the M1) — the full brain stack

**1. Name it on the mesh + install secret-guard hooks**
```bash
cd ~/TMMT                     # or wherever the repo lives
bash scripts/swarm-join.sh --name brainiac-mac --email you@personal.example
```

**2. Boot the assistant brain**
```bash
bash scripts/hailmary booyah   # boot + self-audit + absorb context + macOS always-on
# or the whole base in one: bash scripts/tmmt unison
```

**3. Turn on the texting channel (iMessage bridge)**
```bash
bash scripts/setup-mac-imessage-bridge.sh
# then grant Messages + Terminal "Full Disk Access" when prompted (System Settings → Privacy)
```
Now the local assistant can **read + send real texts** through Messages.
Details/troubleshooting: [`MAC-IMESSAGE-BRIDGE.md`](./MAC-IMESSAGE-BRIDGE.md).

**4. Make the carry Mac able to reach it (Tailscale SSH)**
```bash
# on the M1:
bash scripts/mesh/link.sh serve          # go reachable on the tailnet
# on the carry Mac, when you want to co-drive the brain:
bash scripts/mesh/link.sh assist brainiac-mac
```

**5. Harden the endpoint** (it's now your most important machine)
- ☐ FileVault ON  ☐ Dashlane + passkey/app 2FA  ☐ SIM-swap PIN on the phone that texts it
- ☐ `aixmos integrity` clean (run on a schedule)

---

## Keep-it-alive (the brain's #1 job)

The assistant only works while the M1 is **awake + on Tailscale**. Make that
automatic so it never silently goes dark:

```bash
caffeinate -s &                          # keep awake while plugged in (quick version)
# better: the macOS LaunchAgents from `hailmary booyah` / `tmmt unison` keep it
# always-on across reboots — confirm they're loaded after setup.
```
- Wake-on-LAN / "start up after power failure" ON (System Settings → Energy).
- Leave it plugged in, lid-open or in clamshell with power.

---

## The everyday loop (once it's up)

1. **M1 is always booted** and listening (HAILMARY).
2. From your **phone or carry Mac**, you message it in plain language —
   *"what's on today," "text Umar the funding doc," "spin up two agents on the
   build."*
3. It **acts and replies like a person**, and pings you on Slack/Telegram for
   anything urgent (`.env.notify`).

---

## Backup brain (`brainiac-win`)

The $3k Windows build stays on as **heavy-compute + warm failover**. If the M1
is ever down, it's the standby — but the *talk/text* experience stays on the Mac
(that's where the rails are). No action needed beyond keeping it powered and on
the tailnet.

---

> **What I can do from here (cloud session):** prep/verify scripts, docs, and
> the repo. **What only you can do (on the M1):** the 5 steps above — they need
> your local logins, Full Disk Access, and Apple ID. Ping me if any step errors
> and I'll debug it with you.
