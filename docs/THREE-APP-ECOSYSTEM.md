# TMMT × AIXMOS — ONE app (supersedes the three-app plan)

> Owner decision 2026-09-03: **`tmmt-ops` is the only app.** It carries daily ops,
> the owner command center (`/command`, `/executive`, `/investor`, `/operators`),
> training (`/learn`), the operator program (`/work`), and every intake form
> (`/forms/*`). **Every public visitor is routed to the GHL site
> `allinonemanagementsolutions.com`** (All In One Management), which is not on
> Vercel at all (Cloudflare → GHL).

| Surface | Where | Audience |
|---|---|---|
| Ops, command center, training, forms | `tmmt-ops` on Vercel (`tmmt-ops.vercel.app`, git → `master`) | staff, owner, operators, members |
| Marketing, checkout, funnels | GHL site `allinonemanagementsolutions.com` / `.net` | public |

Routing rules in the app (`src/lib/site-domains.ts`, `src/middleware.ts`, `next.config.ts`):
- anonymous hit on `/` → GHL site (staff use `/login`)
- `/credit`, `/funding`, `/lp/*/intro-97`, `/lp/*/lead-magnet` → GHL site with UTM
- `/forms/*` stay on the app; the GHL site links to them; its origins are CORS-allowed for lead POSTs

## Retired Vercel projects (all deployed this same repo)

All three are **PAUSED**, not deleted — they return 503 `DEPLOYMENT_PAUSED`, and
one `unpause_project` call brings any of them back.

| Project | Why it existed | State | What was kept |
|---|---|---|---|
| `tmmt-command-center` | May 2026 prototype (disjoint git history) | paused 2026-09-09 | full tree at tag `archive/command-center-2026-05-18`; business records in `docs/archive/command-center-2026-05/`; triage in `COMMAND-CENTER-CARRYOVER.md` |
| `tmmt-training-site` | never had a production deploy | paused | nothing to keep; academy = `/learn` |
| `aixmos-offer` | never had a production deploy | paused | nothing to keep |

### `aixmos-landing` is NOT retired

**Owner decision 2026-09-09: it stays serving at `aixmos-landing.vercel.app`,
as-is.** It is a standalone static marketing page whose CTAs feed the GHL site.

- Its Vercel project has **no git link** — pushes to this repo do not touch it.
  `AIXMOS/public/` is a *copy* of what it serves (same title, same prices), not
  its deploy source. Editing that folder changes nothing live.
- It carries its **own** price list, independent of `src/lib/pricing/catalog.ts`.
  The two can drift and nothing will catch it.
- It sends no `noindex`, so it can be indexed alongside the GHL site.

Those last two are known and accepted, not bugs to fix unasked.
`AIXMOS/public/README-RETIRED.md` still calls the project retired — stale, and
left alone here because the folder is reference material either way.

Harvest (settings, env var inventory, domains, deployed source) lives at
`~/Archive/vercel-harvest-20260903/` **on the M1** — it is not on Carry.
Deletion is owner-only and optional (pausing already achieved the outcome,
reversibly): `bash scripts/retire-vercel-duplicates.sh --apply`, which now
refuses to run if that harvest folder is not present on the machine.

`vercel.json` disables deployments from the `swarm-coord` bot branch, which was
creating a BLOCKED deployment every ~3 minutes on every project.

## Smoke

```bash
bash scripts/smoke-dispatch.sh          # one app + GHL public site
curl -sS -o /dev/null -w "%{http_code}\n" https://tmmt-ops.vercel.app/login
```
