# Brain resilience — make it never let you down

> The access layer (Tailscale + SSH) is solid. This closes the gap between
> "works" and "I depend on it every day." Four things: **power, failover,
> knowing it's down, and offsite backup.** Pairs with
> [`BRAINIAC-MAC-SETUP.md`](./BRAINIAC-MAC-SETUP.md) and
> [`FLEET-ROSTER.md`](./FLEET-ROSTER.md).

The honest framing: a home-hosted brain's weak link is **your house** — power
and internet. None of this makes it bulletproof; it makes it *resilient* — it
rides out the common failures and tells you fast when it can't.

---

## 1. Power — ride out the blips (~$60, biggest ROI)

A brief outage or brownout shouldn't take your assistant offline until someone
walks to it.

- **UPS battery** on **both the M1 and the router/modem** (a small 600–900VA unit
  is plenty). This alone removes the #1 everyday failure.
- **M1:** keep it **plugged in, clamshell with an external display or in a stand**,
  or set *Prevent automatic sleeping when display is off* (Battery → Options). The
  one-shot already sets `pmset` to never sleep on power.
- **`brainiac-win` (BIOS — can't be scripted):** enable **"Restore on AC Power
  Loss" = On** and **Wake-on-LAN**, so the tower auto-powers-back-on after an
  outage. This is what makes it a *real* warm failover, not just a label.

## 2. Failover — the tower behind the Mac

- **M1 (`brainiac-mac`)** = primary/assistant. **Tower (`brainiac-win`)** = warm
  backup + heavy compute.
- Both run the one-shot, both stay on the tailnet, both auto-rejoin on boot. If
  the M1 is down, you still `ssh you@brainiac-win` from the carry M5 and keep
  working. The *talk/text* assistant stays Mac-side (that's where the rails are),
  but your data + compute + remote shell survive a single-box loss.

## 3. Know the moment it goes dark

Silent failure is the enemy. You already have presence/heartbeat tooling — use it
as the tripwire:

```bash
# from the carry M5 (or any device on the tailnet):
tailscale ping brainiac-mac          # is the brain reachable right now?
bash scripts/mesh/presence.sh        # whole-fleet board: who's ● online / ○ offline
```

- Run `scripts/mesh/presence.sh loop` (or its LaunchAgent,
  `scripts/mesh/install-launchagent.sh install`) on an always-on box so beats are
  continuous.
- Wire an alert: if a brain misses heartbeats, the mesh notify channel
  (`.env.notify` → Slack/Telegram) pings you. That's the difference between
  "noticed in 30 seconds" and "noticed when you needed it and it wasn't there."

## 4. Offsite backup — survive fire / theft

`memory-sync.sh` keeps a **local** copy (M1 → home vault). That dies with the
house. **`scripts/mesh/vault-backup.sh`** pushes an **encrypted** snapshot
off-property — unreadable without your key, so the destination can be any cloud.

```bash
# one-time config (in your shell profile — never commit values):
export VAULT_BACKUP_AGE_RECIPIENT="age1..."          # your age public key (recommended)
export VAULT_BACKUP_RCLONE_REMOTE="b2:tmmt-brain-backups"   # any rclone remote
# then:
bash scripts/mesh/vault-backup.sh once       # encrypt + push now
bash scripts/mesh/vault-backup.sh install    # daily at 03:30 (macOS LaunchAgent)
bash scripts/mesh/vault-backup.sh restore-help
```

- Encryption is **mandatory** — the script refuses to send plaintext offsite.
- Keep the age key/passphrase in **Dashlane**. Without it the backup is
  unreadable (that's the point) — but so is losing it. Vault it now.
- 3-2-1 rule: local vault (memory-sync) + offsite encrypted (this) + the git repo
  for code/specs = three copies, two media, one off-site. ✓

---

## 5. Lock who can reach the brain (network)

The one-shot turns on SSH. By default that's reachable by **any** device on your
tailnet — tighten it so it's **owner-only**:

- Tag both brains `tag:brain` and apply the updated ACL in
  [`../infra/tailscale-acl.jsonc`](../infra/tailscale-acl.jsonc) (owner-only SSH,
  offshore explicitly denied — with policy tests).
- Tag the family device that ran the setup `tag:family` — it gets **no** access
  to the brain (it built it; it doesn't need in).
- Apply by pasting the ACL into the Tailscale admin → Access Controls. **Review
  first** — an ACL change is the one thing that can lock *you* out if rushed.

---

## Resilience checklist

- [ ] UPS on the M1 + router
- [ ] M1: plugged in, no-sleep confirmed (one-shot did `pmset`)
- [ ] `brainiac-win`: BIOS "Restore on AC Power Loss" + Wake-on-LAN ON
- [ ] Both brains auto-rejoin tailnet on boot (one-shot did this)
- [ ] Presence heartbeat running on an always-on box + notify wired
- [ ] `vault-backup.sh` configured (age key + remote) and `install`-ed
- [ ] age key/passphrase saved in Dashlane
- [ ] `tag:brain` ACL reviewed + applied (owner-only SSH)
