# Quickstart — set up any computer in 3 steps

> So simple it's copy-paste. Run this on **each** machine (carry Mac, work Mac,
> brainiac PC). You need: the code, your **license key**, and ~10 minutes.

---

## Mac / Linux (carry Mac, work Mac, Linux box)

```bash
# 1. Get the code
git clone https://github.com/AIXMOS537/TMMT.git && cd TMMT

# 2. Set it up with your license key  (preview first — no --apply)
bash scripts/setup-node.sh --license AIXMOS-XXXX-XXXX-XXXX-XXXX --role carry
bash scripts/setup-node.sh --apply --license AIXMOS-XXXX-XXXX-XXXX-XXXX --role carry

# 3. Check it
bash scripts/aixmos.sh doctor
```

Roles: `--role carry` (your carry Mac, the brain hub) · `--role work` (work Mac) ·
`--role node` (any other).

## Windows (the brainiac PC) — PowerShell

```powershell
git clone https://github.com/AIXMOS537/TMMT.git ; cd TMMT

# preview, then apply
powershell -ExecutionPolicy Bypass -File scripts\setup-node.ps1 -License AIXMOS-XXXX-XXXX-XXXX-XXXX -Role brainiac
powershell -ExecutionPolicy Bypass -File scripts\setup-node.ps1 -Apply -License AIXMOS-XXXX-XXXX-XXXX-XXXX -Role brainiac
```

---

## What the setup does for you (so you don't have to)

1. **Checks your license key** (won't `--apply` without a valid one).
2. **Installs** what's missing — git, node, **Ollama** — via brew / apt / winget.
3. **Pulls a local model** (`qwen2.5-coder:14b` by default; change with `--model`).
4. **Stages the router** config (`litellm.config.yaml`) — you just edit the tailnet IPs.
5. **Wires the fact-check gate** so nothing leaves the machine broken.
6. **Self-checks** with `aixmos doctor` and prints your next step.

## After setup, on each machine

```bash
# turn on the router (carry Mac / brainiac), edit IPs first:
litellm --config litellm.config.yaml --port 4000
export LITELLM_BASE=http://127.0.0.1:4000/v1     # or the carry-Mac tailnet IP from other boxes

# daily:
bash scripts/aixmos.sh brief            # morning glance
bash scripts/aixmos.sh verify --apply   # fact-check a change (local model fixes red)
```

## Order to bring the mesh up (tonight)

1. **Carry Mac** (`--role carry`) → run Ollama + LiteLLM. This is the hub (CARRY).
2. **Brainiac PC** (`-Role brainiac`) → big models / GPU (BRAIN). Point at tailnet.
3. **Work Mac** (`--role work`) → set `LITELLM_BASE` to the carry Mac's tailnet IP (FORGE).
4. Join all on **Tailscale**, apply the ACL (`infra/tailscale-acl.jsonc`).

## If you get stuck

- `aixmos doctor` tells you exactly what's missing on that machine.
- Run setup **without** `--apply` first to see the plan — it changes nothing.
- Full operating guide: `docs/OPERATOR-RUNBOOK.md` · whole system: `docs/AIXMOS-SYSTEM-INDEX.md`.

---

_The license key gates `--apply`. Format: `AIXMOS-XXXX-XXXX-XXXX-XXXX`. Set
`AIXMOS_LICENSE_URL` to activate against your license server; otherwise it's
format-checked offline._
