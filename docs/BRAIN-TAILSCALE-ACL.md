# HAILMARY brain — Tailscale ACL (owner + family only)

This box (`macbook-pro-2`, `100.77.126.8`) is the LOCAL brain. Lock it so ONLY
the owner and explicitly-chosen family/friend devices can reach it over the
tailnet — nothing public, no funnel.

## 1. Tag this box `tag:brain`

After the ACL below is saved (it defines `tag:brain` in `tagOwners`), tag this
machine either in the admin console (Machines → macbook-pro-2 → Edit ACL tags →
`tag:brain`) or from the box:

    tailscale up --advertise-tags=tag:brain

(That re-asserts the node and may prompt a quick re-auth.)

## 2. Tag family/friend devices `tag:family`

In the admin console, add `tag:family` to each device you want to allow
(e.g. a spouse's laptop, a trusted friend's phone). Devices WITHOUT this tag
(and users other than the owner) get no access to the brain — default-deny.

## 3. ACL (paste into the Tailscale admin console → Access Controls)

```hujson
{
  "tagOwners": {
    "tag:brain":  ["autogroup:admin"],
    "tag:family": ["autogroup:admin"]
  },

  "acls": [
    // Owner's own devices: full reach across the owner's tailnet.
    { "action": "accept", "src": ["AIXMOS537@"], "dst": ["AIXMOS537@:*"] },

    // The brain box: reachable ONLY by the owner + tagged family devices,
    // and ONLY on the brain's local services:
    //   5433  = Postgres+pgvector (brain DB)
    //   11434 = Ollama (local AI)
    //   3000  = HAILMARY app / /api/memory
    {
      "action": "accept",
      "src": ["AIXMOS537@", "tag:family"],
      "dst": ["tag:brain:5433,11434,3000"]
    }
  ],

  // Optional: owner-only Tailscale SSH into the brain box.
  "ssh": [
    {
      "action": "accept",
      "src":    ["AIXMOS537@"],
      "dst":    ["tag:brain"],
      "users":  ["ceo.moe"]
    }
  ]

  // Everything else is denied by default. No funnel, no public exposure.
}
```

> Replace `AIXMOS537@` if your owner login differs, and assign `tag:family`
> to the specific devices you trust. To grant a friend on a *separate*
> Tailscale login, add their email to the `src` lists instead of `tag:family`.
