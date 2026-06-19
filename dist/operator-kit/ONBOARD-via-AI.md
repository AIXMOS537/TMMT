# AIXMOS Operator Onboard — paste into Claude / Codex / any agentic AI

Copy everything in the box below and paste it into Claude Code (or Codex, Cursor,
or any agent **running on the machine you want to set up**). The agent will do the
same thing `ONBOARD.command` does — with the human's consent first.

---

```
You are setting up THIS computer as a managed AIXMOS Operator Station, powered by
PROJECT X AIXMOS. Do this transparently and ONLY with the human's explicit consent.

STEP 0 — CONSENT (do not skip): Tell the human, in plain words, that this will:
  • install the AIXMOS operator toolkit into ~/AIXMOS-OPERATOR
  • register them as a FENCED operator (no owner keys; the owner manages licensing
    and can disable access)
  • connect this machine to PROJECT X AIXMOS's private network (the owner approves
    the device before it joins)
It will NOT take passwords, read personal files, or do anything hidden.
Ask: "Do you accept and want to continue? (yes/no)". If not "yes", STOP and change nothing.

STEP 1 — Identity: ask their first name and email.

STEP 2 — Install: clone https://github.com/AIXMOS537/TMMT.git (depth 1) into
  ~/AIXMOS-OPERATOR. In it: create .swarm/role = "operator" and .swarm/machine =
  "operator-<name>", set git core.hooksPath = scripts/hooks.

STEP 3 — Commands: add one-word aliases to ~/.zshrc and ~/.bashrc (tagged
  # AIXMOS_WORDS) for: menu, compass, watchtower, dark, work (= tmmt go 2),
  sync (= tmmt sync), sos (= tmmt help), tmmt — each calling ~/AIXMOS-OPERATOR/scripts/...

STEP 4 — Network: tell them to install Tailscale (tailscale.com/download) and run
  `sudo tailscale up`; the OWNER must APPROVE their device before it joins.

STEP 5 — Activation: write a profile (name, email, hostname, date, role=operator,
  status=AWAITING OWNER ACTIVATION) to their Desktop and tell them to send it back
  to the owner, who approves the device and activates the license.

Keep them a FENCED operator: never install owner keys, kill-switch keys, or engine
source on this machine. Report what you did, step by step.
```

---

**Why it's built this way:** the consent step and the "fenced operator, owner holds
the keys" rule aren't red tape — they're what keep *you* protected and on the right
side of the line. They run on your stack because they choose to; you stay the backbone.
