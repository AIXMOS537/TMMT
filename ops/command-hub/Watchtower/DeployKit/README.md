# 🛰️ AIXMOS Fleet Watchtower — Rollout Guide

Turn the tablet into the screen that watches every computer at home and the office:
who's up, who's down, how each one is doing (CPU/RAM/disk), who's logged in, what
app they're using, and a live view of any screen on demand.

---

## ✅ Already live on the tablet
- **Watchtower** (up/down board) — CEO Dashboard → **🛰️ Fleet Watchtower → Watchtower**,
  or [http://127.0.0.1:8787](http://127.0.0.1:8787). Auto-starts at login. Reads the
  Tailscale mesh directly — every machine that joins the mesh shows up automatically.

---

## 📦 What's in this DeployKit
| File | Run on | What it does |
|---|---|---|
| `1-JOIN-MESH.bat` | each **office** PC | puts it on the secure mesh so it can be watched |
| `2-INSTALL-HUB.bat` | **Brainiac only** | makes Brainiac the always-on hub (collects deep stats) |
| `3-INSTALL-AGENT.bat` | **every Windows** PC | reports health + activity + installs RustDesk (screens) |
| `INSTALL-AGENT-MAC.command` | each **Mac** | same as the agent, for macOS (LaunchAgent + RustDesk) |
| `4-INSTALL-ALERTS.bat` | **Brainiac only** | pushes your phone when a machine goes down / back / low disk |

Copy this whole folder to each machine (USB or download), then run the files **as
administrator** (right-click → Run as administrator).

---

## 🚀 Do it in this order

**1. Office machines → join the mesh**
Run `1-JOIN-MESH.bat`, sign in once as **AIXMOS537**. (Home machines are already on.)

**2. Brainiac → become the hub**
Run `2-INSTALL-HUB.bat` on Brainiac. It opens port 8787 to the mesh only, starts the
hub always-on, and installs RustDesk. Verify from the tablet:
**CEO Dashboard → 🔭 Deep Hub**, or [http://100.117.163.93:8787](http://100.117.163.93:8787).

**3. Every machine → install the agent**
- **Windows:** run `3-INSTALL-AGENT.bat` on each PC (including Brainiac and the tablet).
- **Mac:** double-click `INSTALL-AGENT-MAC.command`. On first run macOS asks to allow
  Accessibility/`osascript` so it can read the active app — click **Allow**.

Within ~20s each card fills in with live CPU / RAM / disk / uptime, the logged-in user,
and the active app. The agent runs hidden and restarts at every login.

**4. Phone alerts**
Run `4-INSTALL-ALERTS.bat` on Brainiac. It prints a private **topic**. On your phone:
install the **ntfy** app (App Store / Play), tap Subscribe, server `ntfy.sh`, paste the
topic. You'll get a push when any machine goes **down**, comes **back**, a disk gets
**critically full** (≥92%), or a machine's **CPU stays pegged** (≥90% for a few minutes).

**5. Live screens (one-time per machine)**
After RustDesk installs, open it once on each machine and set a **permanent password**
(Settings → Security) and note its **ID**. To view a screen: open RustDesk on the
tablet, enter that machine's ID + password. Connections go directly over Tailscale.

---

## 🕒 Worklog (who worked how long)
Once agents are reporting, the hub records activity all day. See it from the tablet:
**CEO Dashboard → 🕒 Worklog**, or [http://100.117.163.93:8787/worklog](http://100.117.163.93:8787/worklog).
Shows each person/machine's first–last activity and **active minutes** (time where the
machine wasn't idle). Pick any past date. Data is plain daily CSVs in the hub's
`worklog\` folder — nothing leaves your network.

## How it fits together
- **Up/down** comes from Tailscale (works with zero agents).
- **Deep stats** (CPU/RAM/disk/user/active-app) come from the tiny `aixmos-agent.ps1`,
  which posts to the hub every 20s. No Docker, no cloud, no third-party account.
- **Hub = Brainiac** (always on) so reporting never stops when the tablet sleeps. The
  tablet is just the screen — **🔭 Deep Hub** tile shows the full board; the local
  **🛰️ Watchtower** tile is the always-available up/down fallback.
- **Screens** = RustDesk, peer-to-peer over the mesh.

## Change the hub address
Agents default to Brainiac at `100.117.163.93`. If that ever changes, edit the top of
`aixmos-agent.ps1` (`$Hub`) or re-run the agent with `-Hub http://<new-ip>:8787`.

## Phones / Macs
Windows **and Macs** report full health + activity (use the matching installer). Phones
show up/down only — that's all a phone exposes.
