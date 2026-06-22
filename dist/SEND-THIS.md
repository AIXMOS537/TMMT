# Plug-and-play onboarding — send the right file to each device

> Self-contained. No repo, no clone, no login, no internet needed. You send **one
> file**, they run it, they send the result back. Works on any device.

---

## Which file goes to whom

| Person | Device | Send them | They run it by |
|---|---|---|---|
| **Moe Legacy** | M5 MacBook Pro (macOS) | `dist/onboard.command` | double-click it (or `bash onboard.command`) |
| **Ayyan Khan** | Dell XPS (Windows) | `dist/onboard.ps1` | right-click → **Run with PowerShell** |
| anyone on Linux | Linux | `dist/onboard.command` | `bash onboard.command` |

## How to send them

The two files are in this repo under `dist/`. Get them onto your machine, then
AirDrop / text / email / USB the matching one to each person:
- Moe (Mac) → **onboard.command**
- Ayyan (Windows) → **onboard.ps1**

(macOS first run: if double-click is blocked, right-click → Open → Open. Or in
Terminal: `chmod +x onboard.command && ./onboard.command`.)
(Windows first run: if blocked, run `powershell -ExecutionPolicy Bypass -File onboard.ps1`.)

## What happens on their device

1. It shows **THE MISSION** and won't continue until they type `I ACCEPT THE MISSION`.
2. It runs the interview (name, role, what they'll own, skills, first step, agree to rules).
3. It saves a profile to their **Desktop**: `TMMT-onboarding-<name>.txt`.
4. It prints their workflow + tells them to **send that file back to you**.

## What you do with it

- They text/email/AirDrop you their `TMMT-onboarding-<name>.txt`.
- You review it, then **grant** their access (role + scope, Tailscale invite,
  brokered secrets) per `docs/IT-SUPPORT-TEAM-PLAYBOOK.md` §7. Everyone starts in DEV.

## Notes

- **No passwords are ever collected.** Onboarding captures intent + mission acceptance only.
- It's fully offline + self-contained — safe to send anywhere, runs on any machine.
- For the **full** workflow (the repo, the gate, security hardening) they get the
  Legacy/repo bundle **after** you grant them — onboarding comes first.
