# Everyday Ghost — Recommended Defaults

> The daily-driver layer for [`GO-GHOST-PROTOCOL.md`](./GO-GHOST-PROTOCOL.md).
> One opinionated, reliable pick per need — set it once, run it on autopilot.
> Track rollout in [`FOOTPRINT-CLEANUP-TRACKER.md`](./FOOTPRINT-CLEANUP-TRACKER.md).

This is the **"what do I actually use" sheet.** No menus to agonize over — each
row is a safe, mainstream, well-supported default. Swap only if you have a real
reason. Anything touching legal/financial titling says **confirm with
attorney/CPA** — that's the one place not to freelance.

---

## The everyday stack (recommended defaults)

| Need | Default pick | Why this one | Backup option |
|---|---|---|---|
| **Password vault** | **Dashlane** (already yours ✓) | Cross-platform, unique creds everywhere, breach alerts | 1Password / Bitwarden |
| **2FA** | **Passkeys** where offered; **authenticator app** otherwise | Phishing-resistant; beats SMS | Authenticator in Dashlane |
| **Root-email + vault lock** | **Hardware key (YubiKey ×2)** | Unphishable; closes account-takeover | App-based 2FA fallback |
| **Email aliases** | **iCloud Hide My Email** (you're Apple-heavy) | Native on your Macs, unlimited aliases, zero friction | SimpleLogin (cross-platform/portable) |
| **Public / business phone** | **Google Voice** (everyday) → dedicated business VoIP for X | Free, reliable, keeps personal cell private | OpenPhone for a true business line |
| **Physical mail** | **Virtual mailbox** (Anytime Mailbox / iPostal1) | Real street address, scan-to-app, no home exposure | Local CMRA / PO box |
| **Registered agent** | **Northwest Registered Agent** | Privacy-focused, national, reliable service-of-process | Your CPA's preferred agent |
| **Continuous broker removal** | **Incogni** | Set-and-forget, broad coverage, affordable | DeleteMe (human-assisted reports) |
| **Per-vendor card numbers** | **Privacy.com** | Vendor-locked virtual cards; stops identity-stitching | Bank-issued virtual cards |
| **Daily browser hygiene** | **uBlock Origin** + tracking protection on | Kills the trackers that re-stitch your profile | Brave / Safari with protections on |

> **Apple-ecosystem note:** you run Macs across the board (M1, carry Mac, work
> Mac), so the native picks — **Hide My Email** and **passkeys via iCloud
> Keychain** — are the lowest-friction reliable defaults. Keep **Dashlane** as
> the cross-platform vault of record so nothing is locked to one device.

---

## The five everyday habits (this is the whole game)

These are the muscle-memory rules. Get these automatic and the architecture
maintains itself.

1. **New signup? → alias email + VoIP number.** Never the root email, never the
   personal cell. (Hide My Email makes this one tap.)
2. **Any public form / filing? → entity + virtual address.** Default to the
   business, not yourself.
3. **New domain? → WHOIS privacy on, registrant = entity + virtual address.**
   Never your name.
4. **New vendor charge? → Privacy.com card.** Keeps purchases from stitching you
   back together.
5. **Personal cell + personal email + home address = appear on nothing public.**
   Ever. This is the one bright line.

---

## Set-and-forget cadence

| When | Do | Where |
|---|---|---|
| **Once, now** | Stand up the stack above; migrate public contact points to alias/VoIP/virtual address | Tracker → 30-Day Checklist |
| **Each new account** | Born through an alias (Habit 1) | — |
| **Monthly (5 min)** | Glance at Incogni report; confirm removals progressing | Tracker → Tab C |
| **Quarterly (30 min)** | Re-search your name, re-pull brokers, re-lock 2FA/PINs | Tracker → Quarterly Re-Audit |
| **Yearly** | Renew virtual mailbox + registered agent; review entity titling | Confirm w/ attorney/CPA |

---

## Owner-only set-up steps (can't be automated for you)

These need *your* logins/identity and a human decision — do them once:

- **Carrier SIM-swap / port-out PIN** with your mobile provider (closes the #1
  takeover vector).
- **Hardware keys** registered to root email + Dashlane.
- **Registered agent + virtual address** onto every state filing, domain, and
  license.
- **Entity / trust asset titling** (vehicles, property, high-value gear) —
  **confirm structure with attorney/CPA** before changing any title.

Everything else (the tracker, the checklists, the X node build) I can prep and
maintain in the repo on request.
