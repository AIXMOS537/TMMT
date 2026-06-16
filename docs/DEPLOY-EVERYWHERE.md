# Deploy Everywhere — any Mac, iPhone, Apple device, or Android

One system, every device, two roles. **Owner** machines get the full kit;
**operator** devices are fenced to least-privilege (per the charters). Phones
become a secure window into a deployed machine over Tailscale.

> Card to hand someone: `docs/cheatsheets/POCKET-CARD.png` (scannable).
> Wallpapers: `HAILMARY-PHONE.png` / `HAILMARY-ANDROID.png`.

---

## The matrix

| Device | Role | How to deploy |
|---|---|---|
| **Mac (yours)** | owner | one-liner ↓ then `bash scripts/deploy owner` |
| **Mac (operator)** | operator | one-liner ↓ then `bash scripts/deploy operator` |
| **Linux laptop** | either | same as Mac |
| **Windows** | either | install Git → **Git Bash** → same one-liner |
| **iPhone / iPad** | window | Tailscale + a-Shell/Blink + Shortcuts → `docs/MOBILE.md` |
| **Android** | window | Tailscale + Termux → `docs/MOBILE.md` |

---

## 1) Any computer — the one paste

Mac / Linux / Windows-Git-Bash. Paste as ONE line (no `#` comments):

```bash
B=claude/organize-chats-sessions-7t7zjy; R=""; for d in ~/Projects/TMMT ~/projects/TMMT ~/TMMT ~/Documents/TMMT ~/Desktop/TMMT; do [ -d "$d/.git" ] && R="$d" && break; done; [ -z "$R" ] && R=~/TMMT && git clone https://github.com/AIXMOS537/TMMT.git "$R"; cd "$R" && git fetch origin "$B" && git checkout "$B" && git pull origin "$B" && bash scripts/deploy
```

It asks **owner or operator** once, sets up identity + secret-guard, installs the
one-word commands, and (on Mac) drops Desktop icons. After that, every machine is
just: open a terminal → type **`menu`**.

Skip the question by being explicit:

```bash
bash ~/TMMT/scripts/deploy owner      # or: operator
```

---

## 2) What each role gets

**Owner** (your machines):
`unison` · `booyah` · `onboard` · `aixmos` · `compass` · full menu + Desktop icons
(Booyah / Onboard / Compass / TMMT).

**Operator** (their laptops) — fenced, no owner agents, no secrets:
`work` · `sync` · `who` · `sos` · `compass` · `update` + Desktop icons (TMMT / Work
/ Compass). HAILMARY and the client decoder stay owner-only by charter.

Everyone, every device, gets **`compass`** — protect the user first.

---

## 3) Phones (iPhone / Android) — the pocket

Phones don't run the deploy; they reach a deployed machine privately. Full
step-by-step with the exact apps and one-tap buttons: **`docs/MOBILE.md`**.
The short version:

1. **Tailscale** app → sign in (now on the private mesh).
2. A terminal app — **a-Shell/Blink** (iOS) or **Termux** (Android).
3. `ssh <you>@<machine-tailscale-name>` → type the words.
4. (iOS) **Shortcuts** / (Android) **Termux:Widget** → one-tap home buttons for
   `compass`, `booyah`, `onboard`, `menu`.
5. Set the wallpaper so the words are always with you.

Fully offline option: a small on-device model (iOS **Private LLM** / Android
**Ollama in Termux** or **MLC Chat**) — the pocket CHUMMO.

---

## 4) Onboarding an operator (you → them)

1. Send them this file + `POCKET-CARD.png`.
2. They paste the one-liner, choose **operator**.
3. You add their device to Tailscale (least-privilege ACL) and approve.
4. They type `menu` → `work`. If stuck: `sos "what's wrong"` reaches you.

---

## Safety (non-negotiable, every device)

- The **brain stays local** on owner hardware; phones/operators are windows.
- **No secrets leave** — secret-guard hooks + Tailscale-only traffic.
- **Operators fenced** to their lane by role; HAILMARY is owner-only.
- A lost device is removed from the tailnet in one tap; disks stay encrypted.
- `compass` is a **companion, not a clinician** — heavy days point to real help.
