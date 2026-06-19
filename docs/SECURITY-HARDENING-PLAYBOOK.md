# Security Hardening Playbook — reset everything, the safe way

> Your head-of-security plan to go through **every account from day one** and reset
> it clean: unique passwords in a vault, MFA everywhere, keys rotated. You stay in
> control of every login. Worked **one at a time** with `scripts/account-hardening.sh`.

---

## 0. The rules that protect you (read first)

1. **Never give any AI agent (Cursor, Claude, anything) your bank/personal logins**,
   and never let a script auto-reset financial accounts. Agents help with **code/API/
   infra**; **you** do the financial + personal resets in your own browser.
2. **One password manager, one strong master password — memorized, written on paper in
   a safe, never stored digitally.** Everything else lives in the vault.
3. **Unique password per account.** Reuse is how one breach becomes ten.
4. **MFA on everything** — prefer an **authenticator app or passkey/hardware key
   (YubiKey)** over SMS (SMS can be SIM-swapped).
5. **One step at a time.** You don't do this in a night. The tracker remembers where
   you are.

## 1. The tool (guided, local, no passwords stored)

```bash
scripts/account-hardening.sh init       # build your inventory from the template
# edit .aixmos/security/inventory.tsv → add your real accounts (names/urls only)
scripts/account-hardening.sh next       # the next account + its checklist
scripts/account-hardening.sh done "..." # mark it hardened, move to the next
scripts/account-hardening.sh status     # progress board (X / N hardened)
```
The inventory is local + gitignored. It tracks *status only* — never a credential.

## 2. The order (do it top-down — this order matters)

1. **Primary email** — the master key; password resets flow through it. Harden it FIRST.
2. **Password manager** — set up Dashlane / iCloud Keychain / Bitwarden / 1Password;
   strong memorized master password; MFA on the vault itself.
3. **Phone / SIM** — set a carrier **port-out / SIM PIN** (kills SIM-swap attacks).
4. **Identity** — Apple ID + Google (they unlock devices and many logins; add passkeys).
5. **Financial** — personal bank, business bank, Stripe/PayPal. App-based MFA, not SMS.
   Consider a **credit freeze** at all three bureaus (free; stops new-account fraud).
6. **Infra / keys** — GitHub, Vercel, Supabase, Airtable, GoHighLevel, domain/DNS.
   This is the part we **automate** (next section).
7. **Social media** — unique pw + MFA on each.
8. **Subscriptions** — unique pw; **cancel what you don't use** (less to defend).

## 3. The part we automate (code / API / infra)

For anything that's a token/key in your systems, you don't reset it by hand blindly —
inventory then rotate:

```bash
scripts/secret-scan.sh --history     # find every key/token ever committed (redacted)
# then rotate each at its provider — see docs/SECRET-ROTATION.md (per-provider table)
```
Still-open right now: **revoke the Airtable PAT** (`pat8mah6…`) at airtable.com/create/tokens.

## 4. Per-account checklist (what "hardened" means)

For each account: **new unique password → saved in vault → MFA on (app/passkey) →
review recovery options + connected apps + sign out other sessions.** Then mark it done.

## 5. Monitoring (so you *stay* clean)

- **haveibeenpwned.com** — check your emails; turn on notifications for future breaches.
- **Credit freeze** at Equifax / Experian / TransUnion (free) — strongest fraud blocker.
- Re-run `scripts/device-integrity.sh` + `scripts/secret-scan.sh` on a schedule.
- Review account "recent activity" / active sessions monthly.

## 6. Hand-off note (if an agent helps)

You can give **this playbook** to any agent (Cursor, etc.) to help you work the
**infra/key** side and to keep you organized. But the financial + personal resets are
**yours alone** — an agent should never see those passwords. That boundary is the
whole point of being secure.

---

_Tools: `scripts/account-hardening.sh`, `scripts/secret-scan.sh`. See
`docs/SECRET-ROTATION.md`, `docs/FLEET-PRESENCE-SECURITY.md`,
`infra/tailscale-acl.jsonc`. Not legal/financial advice — for high-risk situations
consider a professional security consult._
