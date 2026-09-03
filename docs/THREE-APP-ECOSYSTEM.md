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

| Project | Why it existed | What was kept |
|---|---|---|
| `tmmt-command-center` | May 2026 prototype (disjoint git history) | full tree at tag `archive/command-center-2026-05-18`; business records in `docs/archive/command-center-2026-05/`; triage in `COMMAND-CENTER-CARRYOVER.md` |
| `aixmos-landing` | static marketing site from `AIXMOS/public` | folder kept in repo (`AIXMOS/public/README-RETIRED.md`); superseded by GHL |
| `tmmt-training-site` | never had a production deploy | nothing to keep; academy = `/learn` |
| `aixmos-offer` | never had a production deploy | nothing to keep |

Harvest (settings, env var inventory, domains, deployed source) lives at
`~/Archive/vercel-harvest-20260903/` on the M1. Deletion is owner-only:
`bash scripts/retire-vercel-duplicates.sh --apply`.

`vercel.json` disables deployments from the `swarm-coord` bot branch, which was
creating a BLOCKED deployment every ~3 minutes on every project.

## Smoke

```bash
bash scripts/smoke-dispatch.sh          # one app + GHL public site
curl -sS -o /dev/null -w "%{http_code}\n" https://tmmt-ops.vercel.app/login
```
