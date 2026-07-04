# Portal Sign-In — one branded login, any vertical (plug-and-play)

> Each business/vertical gets its **own branded sign-in page** (name, tagline, color,
> who it's for) — clients, vendors, employees, operators all use the same door and
> land where they belong. Adding a new vertical is **one config entry + one env var.**
> No new code.

---

## How it works
- `src/lib/portal-config.ts` holds a registry of portal brands (one entry per vertical).
- The login page (`src/app/(auth)/login/page.tsx`) renders whichever portal is active.
- `NEXT_PUBLIC_PORTAL` picks the active one (falls back to `tmmt`).

Already included: **`tmmt`** (blue) and **`moelegacy`** (emerald — Credit · Funding · Members).

## Use it for Moe Legacy
In Moe's `.env` (already in `.env.legacy.example`):
```
NEXT_PUBLIC_PORTAL=moelegacy
```
→ their sign-in shows **"Sign in to Moe Legacy · Credit • Funding • Members"** in their
own color. Same secure login flow, their brand. Clients, vendors, and team all enter here.

## Add a FUTURE vertical (e.g. ecom) — 2 steps
1. Add an entry to `PORTALS` in `src/lib/portal-config.ts`:
   ```ts
   const ECOM: PortalBrand = {
     id: "ecom",
     name: "AIXMOS Commerce",
     eyebrow: "Stores • Fulfillment • Owners",
     heading: "Sign in to AIXMOS Commerce",
     subline: "Owners, staff, and vendors — one secure door.",
     welcomes: ["client", "vendor", "employee", "operator"],
     classes: {
       btn: "bg-indigo-600 hover:bg-indigo-700",
       accentText: "text-indigo-600 dark:text-indigo-400",
       ring: "focus:ring-indigo-500 dark:focus:ring-indigo-400",
     },
   };
   // then add `ecom: ECOM` to the PORTALS map
   ```
2. Set `NEXT_PUBLIC_PORTAL=ecom` in that deployment's env. Done.

> Keep Tailwind classes as **full strings** (like above) — the compiler needs literal
> class names, so don't build them dynamically.

## Who it serves
The `welcomes` list (client / vendor / employee / operator / partner / investor) is
the same login for everyone — auth + roles route each person to the right place after
sign-in (`src/lib/auth-roles.ts`). One door, many roles, per vertical.

---

_Verified: typechecks clean. Ships inside every Legacy/ProjectAixmos bundle, so any
vertical you stand up gets its own branded sign-in out of the box._
