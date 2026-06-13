# Pre-install call script — Moe Legacy

**Goal:** Set expectations, get verbal acceptance, share the recovery challenge
phrase **out-of-band** (this call is the OOB channel — do NOT email or text
the phrase).

**Length:** 12-15 minutes. Don't rush; if anything is unclear to Moe, take time.

---

## Before the call (you, ~5 min)

- Have the issued bundle open: `~/Projects/TMMT/scripts/partner-deploy/_issued/moe-legacy/`
- Have the recovery phrase visible in front of you
- Have the legal v0 drafts open: `~/Documents/Business/legal/moe-legacy/`
- Have a notepad to capture anything Moe asks you to follow up on

---

## Script

**Opening (1 min):**

> Hey brother, thanks for hopping on. Got the AIXMOS partner kit ready to send
> over. Want to walk you through exactly what it does, what it doesn't do, and
> what happens if something ever goes sideways. Should take us about 15 minutes.
> Sound good?

**What it is (2 min):**

> So what you're getting is a USB drive. You plug it in, double-click one file,
> and it installs the AIXMOS partner stack on your Mac. That's the same tools
> I'm running — Partner app, Brain agent, the credit-funding workflow, the
> lead pipeline.
>
> It's tenant-scoped to you — so when you log in, you see your stuff, I see
> mine. Your clients stay in your GHL and your ClickUp. The system never
> touches that data. Your client info is yours. Always.

**What gets reported (2 min):**

> Here's exactly what the system reports back to me, and I want to be
> upfront about it because we'll see it on the consent screen at install
> too. Every 24 hours, it sends:
>
> - Your Mac's hardware ID, so the license can't be copied to another
>   computer
> - The app version and that it's running
> - Action counts — like how many logins, how many intakes — counts only,
>   not what's in them
> - Once an hour, an audit log of what you did INSIDE the AIXMOS apps
>
> What it does NOT report: your screen, your other apps, your files,
> your conversations, your client data in GHL or ClickUp. None of that.
> The system literally doesn't have the code to capture any of that —
> we deliberately don't ship it.

**Why I'm doing this (1 min):**

> Look, I trust you, and that's why you're the first partner. But this is also
> the first time my full stack goes onto a Mac that isn't mine. I need a way
> to disable the license if something goes wrong — not because I expect it
> to, but because if I don't build that in now, in a year when we have ten
> partners and one of them gets weird, I won't have anything.
>
> The kill switch is a one-way street from me to the app: I can disable
> your install. You can't be force-charged, you can't lose your client
> data, none of that. If I ever hit it, your GHL and your ClickUp are
> untouched. You just can't use the AIXMOS apps until we sort it out.

**The legal v0 docs (2 min):**

> I have three documents on the USB and at /legal/ — the Master Partner
> Agreement, the Data Processing Addendum (DPA), and the Acceptable Use
> Policy (AUP). They're v0 drafts. I have an attorney being engaged to
> review them within 30 days of you signing — there's a clause at the top
> of each that says so. If the attorney redlines anything material, you
> and I sign an amended version. No surprises.
>
> Read them when you get the USB. Call me with questions. We sign before
> install.

**Recovery phrase — OOB share (2 min):**

> Last important thing: if your Mac ever gets lost, stolen, or dies, we need
> a way to be sure it's actually you on the phone asking for a new install
> — not someone who stole your Mac and is impersonating you.
>
> So I'm going to read you a phrase right now. Write it down on paper, or
> save it in 1Password — whatever's secure for you, but NOT in a note app
> tied to that Mac. The phrase is:
>
>   ➤  [READ THE PHRASE TWICE, SLOWLY, FROM RECOVERY-PHRASE.txt]
>
> Got it written down? Read it back to me to confirm.
>
> If you ever need a new install, I'll ask for this phrase before I issue
> a new USB. If someone has your Mac but doesn't have this phrase, I will
> refuse.

**Closing (2 min):**

> OK. I'll ship the USB to [address] — should arrive [day]. When it lands,
> read the legal docs first. Call me when you're ready to install and I'll
> stay on the phone with you while it runs. Sound good?

---

## After the call (you, ~2 min)

- Mark engagement-tracker.md: "Pre-install call complete, phrase shared OOB, recovery phrase confirmed by partner — YYYY-MM-DD"
- Issue + burn the USB: `./burn-partner-usb.sh --partner=moe-legacy --tailscale-authkey=<key>`
- Ship USB. Note tracking number in tracker.
