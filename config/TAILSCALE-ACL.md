# Tailscale ACL — lock the brain to owner + family only

Paste the JSON below into the **protected account's** Tailscale admin →
**Access Controls** → replace it (or merge) → Save. Then tag the brain box:
`sudo tailscale up --advertise-tags=tag:brain` (or set the tag in the admin).

What it does:
- `tag:brain` = the brain box(es) (M1 / appliance / Sovereign Starter).
- **Only** `group:owner` + `group:family` devices can reach `tag:brain`. Everyone
  and everything else is denied by default.
- The brain itself can't initiate connections to your other devices (least privilege).
- SSH into the brain allowed only for owner + family.

Edit the 3 marked lines (emails), nothing else.

```json
{
  "groups": {
    "group:owner":  ["OWNER_EMAIL"],
    "group:family": ["FAMILY_EMAIL_1", "FAMILY_EMAIL_2"]
  },
  "tagOwners": {
    "tag:brain": ["group:owner"]
  },
  "acls": [
    {
      "action": "accept",
      "src":    ["group:owner", "group:family"],
      "dst":    ["tag:brain:*"]
    },
    {
      "action": "accept",
      "src":    ["group:owner", "group:family"],
      "dst":    ["group:owner:*", "group:family:*"]
    }
  ],
  "ssh": [
    {
      "action": "accept",
      "src":    ["group:owner", "group:family"],
      "dst":    ["tag:brain"],
      "users":  ["ceo.moe", "root"]
    }
  ]
}
```

After saving:
- Confirm with **Tailscale → Access Controls → Preview / Tests** that a non-owner
  cannot reach `tag:brain`.
- The brain stays on `tailscale serve` (private), never `tailscale funnel` (public).
- Add each new family build's owner email to `group:family`; tag each brain box `tag:brain`.

Least privilege = nobody outside the people you built it for can even see the brain.
