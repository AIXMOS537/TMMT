# Send files + instructions to family & friends (from the carry Mac)

> One command builds the welcome pack; AirDrop sends it; you grant access. The
> files carry no secrets — the **access link you send** is what actually lets
> someone in, and that stays in your control.

## The one command

```bash
bash scripts/send-pack family      # inner-circle welcome (Project X HAILMARY)
bash scripts/send-pack operator    # operator seat onboarding ($97/mo)
bash scripts/send-pack newmac      # set up a fresh Mac from near-zero
bash scripts/send-pack phone       # phone wallpapers / quick guides
```

It gathers the right guides (`docs/cheatsheets/*`) + the `setup-mac.command`
one-shot into a folder on your **Desktop**, drops a `WELCOME.txt` (your message +
plain steps) in with them, and **opens it in Finder**.

## Then send it (carry Mac)

- **AirDrop** — select the files → right-click → Share → AirDrop → pick the person.
- **Messages** — drag the files into the chat (fastest for phones).
- **Mail** — drag the files into a new email.

## Then grant access (only you can — this keeps it fenced & legit)

The pack gets them *ready*; the **access link** gets them *in*. Per
`docs/ACCESS-GOVERNANCE.md`:

1. **Tailscale** → admin console → invite their device. Tag inner-circle devices
   `tag:family`; operators go the fenced operator path. **This invite is the link
   they need.**
2. **Operators** → issue a named license:
   `scripts/partner-deploy/owner/issue-license.sh` (so every grant has an owner of
   record).
3. **Revoke anytime** → `scripts/partner-deploy/owner/kill-partner.sh` (full
   cut-off), or `bash scripts/godark` to park a node immediately.

## What's in each pack

| Role | Guides | One-shot |
|---|---|---|
| `family` | FOUNDER-WELCOME · HAILMARY-GUIDE · GLOBAL-MESH-JOIN · phone guide | `setup-mac.command` |
| `operator` | TMMT-CHEAT-SHEET · POCKET-CARD · GLOBAL-MESH-JOIN | `setup-mac.command` |
| `newmac` | TMMT-NEW-MAC picture steps | `setup-mac.command` |
| `phone` | iPhone + Android wallpapers/guides | — |

> Compliance stays in the packs: credit is **"guidance," never "repair."** No
> secrets travel — keys/licenses/invites are issued by you from the consoles.
