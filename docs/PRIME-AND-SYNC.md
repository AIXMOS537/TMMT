# Prime & Sync — one-shot on carry Mac + local cross-sync across all 3 devices

> Get the whole base primed on the carry Mac in one shot, then keep the carry Mac,
> the M5 MacBook, and the Surface Pro 4 in lockstep on the mesh. Source of truth:
> `master`. Uses existing tooling — nothing new to learn.

## Your three devices

| Device | OS | Role | One-shot |
|---|---|---|---|
| **carry Mac** (this one) | macOS | owner | `booyah` (already primed) |
| **carry M5 MacBook** | macOS | owner | `setup-mac.command` → `booyah` |
| **Surface Pro 4** | Windows | owner/operator | `setup-node.ps1` → `go` |

All three ride the same private **Tailscale** mesh; `master` is the one source of
truth; `sync` keeps them identical. (Phones are windows — see `docs/MOBILE.md`.)

---

## 1. Carry Mac — one shot (you're here)

```bash
cd ~/projects/TMMT && git pull origin master && booyah
```
That pulls everything new (member engine, memorial tools, the consent kit, the
specs) and boots the whole base always-on. Done.

Verify:
```bash
whoami                     # owner · sealed · clear
member catalog             # the $97 Learn-Earn-Churn store shows up
bash scripts/mesh/install-launchagent.sh status   # always-on loaded
```

---

## 2. Carry M5 MacBook — one shot (new Mac)

On the M5, open Terminal and run the fresh-Mac installer, then boot:
```bash
curl -fsSL https://raw.githubusercontent.com/AIXMOS537/TMMT/master/scripts/setup-mac.command -o ~/Downloads/setup-mac.command
bash ~/Downloads/setup-mac.command
```
It installs tools, clones the repo, joins the mesh, audits security. Then:
```bash
cd ~/Projects/TMMT && bash scripts/deploy owner   # claim owner (needs the seal)
booyah
```
Give it a **unique machine name** when asked (e.g. `carry-m5`) so it never
collides with the carry Mac on the mesh.

---

## 3. Surface Pro 4 — one shot (Windows)

In **PowerShell**:
```powershell
irm https://raw.githubusercontent.com/AIXMOS537/TMMT/master/scripts/setup-node.ps1 | iex
```
Then in Git Bash (installed by the script):
```bash
cd ~/TMMT && bash scripts/deploy owner && bash scripts/go
```
Name it `surface-pro` when asked. (Windows always-on uses Task Scheduler — the
`setup-home-brain.ps1` path; ask me to wire it when you want it lid-down.)

---

## 4. The daily rhythm — stay in lockstep

On **every** device, start and end each work block with one word:
```bash
sync
```
That's `scripts/sync-machine.sh`: **stash → rebase → push**, never force, never
merge. If two devices touch the same file, it stops clean and tells you — no
silent clobber. (This is the safe N-machine sync from `docs/MESH-SWARM.md`.)

Check the whole mesh anytime:
```bash
mesh        # every device, online/offline
map         # the network at a glance
```

---

## The guardrails that keep 3 devices = 1 system
- **One source of truth:** `master`. `booyah`/`go` pull it; `sync` reconciles it.
- **Unique machine names** (`.swarm/machine`) so devices never collide; work rides
  `swarm/<machine>/*` branches.
- **Owner is sealed** (`auth/OWNER.seal`) — each device proves owner with your word.
- **Secrets never sync** — the pre-commit/pre-push guard blocks them; `.env`, vault,
  `.memorial/`, `.hailmary/` are all gitignored and stay local per device.
- **DARK is per-device** — `dark` blacks out the device you're on; your word +
  phone code lifts it.

---

_Companions: `docs/MESH-SWARM.md` (the mesh/sync system), `docs/DEVICE-LOADING.md`
(what runs where), `docs/LEARN-EARN-CHURN.md` (the program now primed on all 3)._
