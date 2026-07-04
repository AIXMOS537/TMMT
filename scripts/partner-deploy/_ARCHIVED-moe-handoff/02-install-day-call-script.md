# Install-day call script — Moe Legacy

**Goal:** Walk Moe through the install live. Catch any errors in real time.
End the call with a working install + first heartbeat visible on your side.

**Length:** 20-25 minutes (includes contingencies).

---

## Before the call

- `~/Projects/TMMT/scripts/partner-deploy/owner/audit-readout.sh --partner=moe-legacy --last=1h` ready in a terminal
- Slack / iMessage ready in case the call drops
- Your laptop on the same coffee as your phone — don't switch contexts mid-call

---

## Script

**Setup (2 min):**

> Hey brother. You got the USB? Mac is plugged in to power? Good.
>
> First — please plug in the USB now. You should see a drive called
> AIXMOS-PARTNER mount on the Desktop.
>
> Open it in Finder. You'll see a file called START-HERE.command —
> double-click it.

**At the consent screen (3 min):**

> The consent screen will open in your browser. Read it. Out loud is fine
> if you want — I'll wait.
>
> [WAIT for him to read]
>
> Have any questions about anything it says? Anything you want me to
> clarify before you accept?
>
> [PAUSE — answer any questions honestly. If anything blocks him, stop the
>  install and we'll resume later.]
>
> OK. In the terminal window, type exactly:  I AGREE  (in caps).
> Then hit Enter.

**During install (5 min):**

> The install is going to take 2-3 minutes. You'll see it:
>
> 1. Capture your Mac's hardware ID
> 2. Redeem the install token with my server
> 3. Join the Tailscale network (you should see a quick prompt; allow it)
> 4. Install the agents
> 5. Set up the launchd jobs (those run the heartbeat, audit, and kill-switch)
> 6. Send the first heartbeat
> 7. Tell you "Install complete"
>
> Read me each line as it appears. If you see anything in red, stop and
> show me a screenshot.

**Verify (3 min):**

> Install complete? Great. On my side I should see your first heartbeat.
> Hold on. [run: ./owner/audit-readout.sh --partner=moe-legacy --last=1h]
>
> Yes — I see your install event and your first heartbeat. Hardware UUID
> matches. We're live.

**Smoke test (5 min):**

> Open AIXMOS Partner from your Applications folder. It'll launch in your
> browser (v1 is a web app; native Mac app is v2). Log in.
>
> Try one thing — pull up your /inbox. You should see your own pipeline,
> not mine. Confirm?
>
> Pull up the credit-funding intake. Submit a test entry — use "test test
> 555-0100" — anything obviously fake. We'll delete it after.
>
> [verify it lands in the audit log]
>
> All good.

**Wrap (3 min):**

> One more thing. Open the file ~/Library/Application Support/aixmos-partner/
> and don't touch anything inside. If you ever see something odd in there
> or in launchd, call me. Don't try to fix it yourself — that's how
> guardrails get tripped.
>
> Recap of what's running on your Mac, in case anyone ever asks:
> - Three launchd jobs: heartbeat (24h), audit (1h), kill-switch (15min)
> - A Python script for each of those
> - A keypair in your Keychain bound to your Mac
> - A web shortcut to the AIXMOS Partner app
>
> Anything weird, call me. You're operational.

---

## Contingency plays

### "Install token already used"

Cause: USB was already plugged in before, OR someone else tried to use it.

Action: Stop install. Pull the old install bundle. Issue a NEW token via
`./owner/issue-license.sh --partner=moe-legacy ...` and re-burn USB.

### "Network error" during token redemption

Cause: Supabase unreachable, or Moe's network is firewalled.

Action: Have Moe try a different network (phone hotspot is the fastest test).
If still failing, abort and debug Supabase first.

### "Tailscale join failed"

Cause: Tailscale not installed, or auth key wrong/expired.

Action: NOT FATAL. The kill-switch + heartbeat + audit all work over public
REST (Supabase) without Tailscale. Continue install; install Tailscale.app
manually later. Moe's Mac won't reach the NAS until Tailscale is up, but
he can still use the cloud apps.

### Heartbeat doesn't appear on your side

Cause: anon-key INSERT being denied (check RLS), or Supabase URL wrong in
partner-config.env.

Action: ssh into Moe's Mac (or screen-share); run:
```
python3 ~/Library/Application\ Support/aixmos-partner/bin/heartbeat.py
```
Read the response. Fix the partner-config and retry.

### Moe says "this feels invasive"

This is the most important contingency. Don't talk past him.

Action: STOP the install. Ask what specifically feels invasive. Read the
consent text again line by line and identify the concern. If it's about
audit log granularity, offer to walk him through what events get logged
(it's in dpa.md Schedule 1). If he still doesn't want to proceed, abort
the install — we can always come back later. Better no install than a
strained partnership.
