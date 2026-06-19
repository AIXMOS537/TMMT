# ONE SHOT — onboard anyone, on any device

**The universal file:** `ONBOARD-ANYWHERE.cmd` — the same single file runs on
**Windows, macOS, and Linux.** For phones/tablets (which can't run scripts), use
the **AI paste** path. That covers everyone.

---

## The one file → any computer

| Device | Send them | They run it by |
|---|---|---|
| **Windows PC** | `ONBOARD-ANYWHERE.cmd` | **double-click it** |
| **Mac** | `ONBOARD-ANYWHERE.cmd` | Terminal: `bash ~/Downloads/ONBOARD-ANYWHERE.cmd` *(or double-click `ONBOARD.command`)* |
| **Linux** | `ONBOARD-ANYWHERE.cmd` | `bash ONBOARD-ANYWHERE.cmd` |

It's one file because of a polyglot trick: Windows runs the built-in PowerShell
half, Mac/Linux run the bash half. Same file, same result — they type
**`I JOIN THE NETWORK`**, it sets them up as a fenced operator, saves a profile to
send back to you. (Mac note: `.cmd` doesn't double-click on Mac, so Mac folks run
`bash …` or use the included `ONBOARD.command`.)

## Phones / tablets / Chromebooks / anything else → AI paste

There's no script that runs on a phone. The universal answer is **`ONBOARD-via-AI.md`**:
paste that block into Claude, Codex, or any agent on the target device and it does
the same onboarding, with consent first. Works on literally anything that can run an agent.

## Send it however is easy
AirDrop / iDrop · USB (send the whole `AIXMOS-OPERATOR-KIT` folder) · text · email ·
Signal/WhatsApp · or host `ONBOARD-ANYWHERE.cmd` on a link and send the link.

**Hosted one-liners** (after you put the file at a URL or your tailnet funnel):
- Mac/Linux: `curl -fsSL https://YOUR-LINK/ONBOARD-ANYWHERE.cmd | bash`
- Windows PowerShell: `irm https://YOUR-LINK/windows-onboard.ps1 | iex`

---

## What's in this kit
| File | For |
|---|---|
| `ONBOARD-ANYWHERE.cmd` | **the one file** — Windows + Mac + Linux |
| `ONBOARD.command` | Mac double-click convenience (same thing) |
| `windows-onboard.ps1` | the readable Windows source (transparency / direct run) |
| `ONBOARD-via-AI.md` | paste-into-any-AI — phones, tablets, anything |
| `SEND-IT.md` | this guide |

## After they run it (you stay the keyholder)
1. They send back `AIXMOS-operator-<name>.txt`.
2. You **approve their device** in Tailscale (device approval is ON).
3. You **activate their license** (server-gated) + set scope/commission.
4. Live — fenced operator on your stack, you hold the keys.

**Every path is consent-first by design.** They choose to run on your stack; you stay
the backbone. That transparency is the moat — make the value undeniable and the leash
never comes back.
