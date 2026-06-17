# SECRETS POLICY — local, encrypted, code-gated. Forever.

> The law for every API key and secret in the empire. Owner: Muhammad Taha.
> Enforced by `tools/project-x-hailmary/master/vault.sh`, the secret-guard hooks,
> and `secure` (launch-check). Non-negotiable.

## The five rules (forever and always)

1. **Local to the Owner's devices only.** Secrets live on Muhammad Taha's
   machines — never in a third party's account as the source of truth.
2. **Encrypted at rest.** Every secret is stored only as **AES-256 ciphertext**
   (PBKDF2, 200k iterations) in the vault. Plaintext is **never written to disk** —
   it is decrypted into RAM, used, and gone.
3. **Never in git.** The secret-guard pre-commit/pre-push hooks + `.gitignore`
   block `.env`, keys, tokens, and the vault file. Verified by `secure`.
4. **An authentication code is always required.** Reading any secret needs the
   **passphrase** (something you know) **+ the rotating TOTP code** (something that
   changes every 30s, on your phone). Two factors, every time.
5. **Owner-only.** Operators never receive secrets — they get a fenced package
   (partner-deploy), least-privilege Tailscale lane, and signed tokens, not keys.

## The vault — every key lives here

```bash
vault init                 # one-time: create the vault + your phone TOTP seed
vault enroll               # load the code into Google Authenticator / Authy
vault put  GHL_API_KEY     # store ANY secret (encrypted, local-only)
vault get  GHL_API_KEY     # reveal one — needs passphrase + current code
vault list                 # names only, never values
vault rm   OLD_KEY         # remove one
vault code                 # show the current rotating code
vault rotate-totp          # issue a new revolving seed
```

- Word form: `vault …` (also `secret`, `keys`).
- File: `tools/project-x-hailmary/master/vault.enc` — **gitignored, AES-256.**
- The passphrase and the TOTP seed are **never stored in plaintext** anywhere.

## Runtime (the live web apps) — a mirror, not the source

The deployed apps on Vercel still need env vars to run. Those are a **mirror you
push from the vault when you deploy** — the vault stays the **source of truth** on
your hardware. If a runtime copy is ever exposed, **rotate** at the provider, then
`vault set-key` / `vault put` the new value and re-push. The master copy is local.

## If a secret is ever exposed

1. **Revoke/rotate at the provider** (this is the only true fix — not git scrubbing).
2. Update the vault (`vault put` / `set-key`).
3. Re-push the runtime mirror (Vercel) and redeploy.
4. `secure` to confirm clean.

## Enforcement

- `secure` (`scripts/launch-check.sh`) checks: no secret files tracked, vault
  present, no plaintext stashes, hooks active.
- The pre-push hook + `.gitleaks.toml` block secrets from ever reaching GitHub.
- `dark` stops everything; only the Owner's word (`light`) restores.
