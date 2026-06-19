# Device Loading — getting the stack ONTO any device, every method, ranked honestly

> Companion to `docs/MOBILE.md` (which covers the **safe default**: phone as a
> private *window* into the brain). This doc answers the harder question: when do
> you actually run the repo **on the device itself**, and what are all the routes
> — including jailbreak — ranked by what's real in 2026 and what fits *this*
> security posture (vault + secrets + owner-only).

## The one principle that decides everything

**The brain stays on owner hardware (the M1). Phones/tablets/cars are windows.**
Every method below is judged against that. Anything that puts **secrets on a
device you carry into the world** fights the charter — so the question is never
just "can I run it here?" but "should the *secrets* live here?" (almost always: no).

---

## 🍎 iPhone — the routes, ranked

### ✅ #1 (recommended): No-jailbreak, App Store tools
You already have this path in `docs/MOBILE.md`. It gives you a **real terminal,
SSH, git, and Linux userland — without jailbreaking**:

- **Blink Shell** or **a-Shell** — terminal + SSH/mosh into the M1.
- **iSH** — a real Alpine **Linux** shell running in iOS userspace (x86 emulation,
  no jailbreak). `apk add git openssh python3`. Slow but genuinely Linux.
- **Working Copy** — full git client (clone/commit/push the repo on the phone).
- **Tailscale** + **Shortcuts** — private mesh + one-tap command buttons.

This runs commands, clones the repo, SSHes to the brain, and triggers `booyah` —
covering ~everything you'd want a phone to do, with the secrets staying home.

### ⛔ #2: Jailbreak / Cydia — **not recommended, and mostly not even possible**
Straight talk, because you asked specifically:

- **Cydia is effectively dead.** It hasn't been meaningfully maintained for years;
  Sileo/Zebra replaced it on the jailbreaks that still exist.
- **Modern iPhones can't be jailbroken.** Public jailbreaks trail hardware badly —
  there is **no reliable public jailbreak for current iPhones / recent iOS**. The
  device you're holding almost certainly has no jailbreak available at all.
- **It would break the very thing this project protects.** Jailbreaking disables
  iOS sandboxing and Secure Enclave guarantees. Putting the **owner's vault /
  secrets / owner-seal** on a jailbroken phone is a contradiction — it's the
  least-safe place to hold them. The whole point of "phone as a window" is so a
  lost or compromised phone leaks **nothing**.
- **It buys you almost nothing here.** The only thing jailbreak adds over iSH +
  Blink + Tailscale is unsandboxed background daemons — which you don't need,
  because the **always-on daemon already lives on the M1**, correctly.

**Verdict:** skip jailbreak. It's high-risk, largely unavailable, and solves a
problem we solved better on the M1. If you ever truly need an always-on Unix box
in your pocket, the answer is **Android (below)**, not a jailbroken iPhone.

---

## 🤖 Android — the real "pocket Linux that runs the repo directly"

Android is the **right device** if you want to actually *run the stack on the
phone*, not just window into it. No jailbreak/root needed:

- **Termux** (from **F-Droid**, not Play — the Play build is crippled): a full
  Linux userland.
  ```
  pkg update && pkg install git openssh nodejs python rsync
  git clone <repo>            # the repo, on the phone
  bash scripts/whoami-tmmt    # words run locally
  ```
- **Tailscale** (Play Store) — phone joins the mesh.
- **Termux:Widget** — one-tap home-screen buttons for `compass`, `booyah`, `menu`.
- **Ollama / MLC Chat** — a real local model on-device for offline companion chat.
- **Rooting (optional, only if you must):** Magisk gives root for background
  services. Same caution as jailbreak — **do not put owner secrets on it.** A
  rooted Android can be a fine *operator/agent* node; it should not hold owner
  authority. Keep `.swarm/role=operator`, never seal owner on a carried phone.

**Verdict:** Android + Termux is the legit way to "load the repo and run terminal/
Linux on the phone." Treat it as a **fenced operator node**, not the keyholder.

---

## 🔌 Direct vs wireless — how the device actually connects

| Need | Wired (direct) | Wireless |
|---|---|---|
| **Phone ↔ brain (M1)** | USB tether possible, rarely needed | **Tailscale + SSH** (the default — encrypted, private) |
| **Phone ↔ car (McLaren)** | **USB → wired CarPlay** (most reliable, charges too) | **Wireless CarPlay** (BT pair → Wi-Fi handoff) or **Bluetooth audio** |
| **Laptop ↔ laptop (mesh)** | Ethernet/USB-C only on a LAN | **Tailscale** across cities |
| **Flash a new device** | `scripts/motherbox` over USB install media | `scripts/deploy` + `swarm-join` over the network |

For the **car specifically:** start **wired CarPlay (USB)** — it's the most
reliable for the always-listening voice loop and keeps the phone charged for long
drives. Move to **wireless CarPlay** once it's working, for the get-in-and-go feel.
(See `docs/IN-CAR-AGENT.md` Phase 3.)

---

## The rule of thumb (memorize this)

```
Run the BRAIN on hardware you OWN and LOCK (the M1, FileVault, sealed).
Run a WINDOW on anything you CARRY (iPhone: no-jailbreak tools).
Run a NODE on anything you want to WORK from (Android+Termux = fenced operator).
NEVER put owner secrets on a device that leaves the building.
```

That keeps the whole mesh as one system — without ever betting the keys on a
jailbroken or lost phone.

---

_See also: `docs/MOBILE.md` (phone-as-window setup), `docs/DEPLOY-EVERYWHERE.md`
(device × role matrix), `docs/IN-CAR-AGENT.md` (the McLaren build),
`docs/HAILMARY-CHARTER.md` (why secrets stay home)._
