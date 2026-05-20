# Tailscale + SSH (office ↔ home)

## 1. Install Tailscale (both Macs)

- https://tailscale.com/download/mac
- Sign in with the same tailnet on office and home.

## 2. Note hostnames

On each machine:

```bash
tailscale status
# e.g. office-mac, home-macbook
```

## 3. Enable SSH on office (receiver)

System Settings → General → Sharing → **Remote Login** ON  
Restrict to your user if prompted.

## 4. Home → office SSH key

On **home**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_tmmt_office -C "home-to-office"
cat ~/.ssh/id_ed25519_tmmt_office.pub
```

On **office** (paste pubkey into `~/.ssh/authorized_keys`):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'PASTE_PUBKEY' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 5. Test over Tailscale

On home:

```bash
ssh -i ~/.ssh/id_ed25519_tmmt_office YOUR_USER@office-mac
```

Optional `~/.ssh/config`:

```
Host office
  HostName office-mac
  User YOUR_USER
  IdentityFile ~/.ssh/id_ed25519_tmmt_office
```

## 6. Optional: pull logs from office

```bash
ssh office 'tail -50 ~/Library/Logs/tmmt-sync/sync-$(date +%Y%m%d).log'
```

Secrets stay in `.env.local` on each machine — never commit or rsync env files.
