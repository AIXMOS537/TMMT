# What the old apps had that canon does not

> Written 2026-08-26. Compares `master` against the two legacy TMMT codebases.

Three separate git histories called TMMT exist, and **none of them share a
common ancestor** — `git merge-base` exits 1 between each pair. They are not
branches of each other; they are different repos that grew similar code.

| codebase | where | age | routes | status |
|---|---|---|---|---|
| **canon** | `AIXMOS537/TMMT` `master` | current | 124 | the one we build |
| old command center | `AIXMOS537/TMMT` @ `0cfcaddf` (branch deleted) | May 2026 | ~110 | dead, deploy 503s |
| tmmt-os | `C:\Users\AIXMOS\CommandCenter\tmmt-os` | Jun 2026 | 86 | local only, no remote |

82 route paths exist in the legacy apps and not in canon. Most are **superseded,
not missing** — canon rebuilt them under different names. This document
separates the two, because "82 missing features" is wrong and would send someone
porting dead code.

---

## Superseded — do not port

Canon already covers these under a different name. Listed so nobody re-ports them.

| legacy route | canon equivalent |
|---|---|
| `/client/dashboard` `/documents` `/status` `/training` `/path` `/updates` | `/learn/dashboard` `/learn/documents` `/learn/status` `/learn/products` `/learn/onboarding` `/learn/coach` |
| `/client/upgrade` `/client/rental` | `/upgrade` `/try` `/pocket/*` |
| `/internal/dashboard` `/internal/admin` | `/executive` `/command/desk` `/work/admin` |
| `/internal/cases` `/internal/cases/[id]` | `/cases` |
| `/internal/dispatch` | `/dispatch/*` — canon is substantially richer (units, responders, incidents) |
| `/internal/operators` | `/operators` `/operator/*` `/operator/training/[moduleId]` |
| `/internal/vendors` | `/vendors` `/workflow-vendors` |
| `/internal/interfaces` | `/interfaces/appointments|contracts|payments|vehicles` |
| `/intake` `/intake/[business]` `/intake/thanks` | `/forms/customer-intake` `/forms/[slug]` `/lp/[org]/[sku]` |
| `/onboarding` | `/learn/onboarding` |
| `/team/dashboard` `/team/[section]` | `/work/program` `/work/review` `/work/supervisor` |
| `/admin/users` `/admin/support` | `/work/admin` |

---

## Genuinely absent — decide on each

Four clusters have no canon equivalent. Ordered by how directly they serve the
stated business model (operators with their own GHL accounts; clients with their
own portal; non-qualifying leads routed to credit repair).

### 1. Venture-scoped tenant views — 25 routes · **highest value**

```
/v/[venture]                      /v/[venture]/fleet        /v/[venture]/leads
/v/[venture]/customers            /v/[venture]/payments     /v/[venture]/contracts
/v/[venture]/appointments         /v/[venture]/waitlist     /v/[venture]/tickets
/v/[venture]/background-checks     /v/[venture]/expenses     /v/[venture]/insurance
/v/[venture]/inspections          /v/[venture]/maintenance  /v/[venture]/vendors
/v/[venture]/do-not-rent          /v/[venture]/former-customers
/v/[venture]/operation-costs      /v/[venture]/interfaces/*
```

**Canon has no tenant-scoped URL pattern at all.** Every admin page is
single-org. The database is already multi-tenant — 88 tables carry `org_id`,
`is_org_member()` resolves membership, and RLS enforces it as of
`20260825_fix_org_isolation.sql` — but the app has no way to *view* a specific
org. This is the missing half of onboarding a second operator.

Worth noting the legacy pattern put the tenant in the URL. An alternative is an
org switcher that sets `acting_org_id()`, leaving URLs unchanged. That decision
should be made deliberately, not inherited from dead code.

### 2. Dealer suite — 10 routes

```
/internal/dealer          /internal/dealer/deals       /internal/dealer/deals/new
/internal/dealer/deals/[id]  /internal/dealer/inventory   /internal/dealer/leads
/internal/dealer/collections /internal/dealer/payments    /internal/dealer/service
/internal/dealer/onboarding
```

Canon has `/dealers` (one page) and `/forms/dealer-apply`. The whole deal
pipeline — inventory, collections, service, payments — exists only in legacy.

### 3. Internal ops tooling — 8 routes

| route | what it did | canon status |
|---|---|---|
| `/internal/ghl-sync` | GHL sync admin UI | canon has webhooks + scripts, no UI |
| `/internal/journey` `/[email]` | per-customer journey timeline | absent |
| `/internal/ledger` `/internal/billing` | ledger and billing views | absent |
| `/internal/sync` `/sync/[id]` | CRM sync runs | absent |
| `/internal/agency` | GHL agency setup | absent |
| `/internal/assistant` | ops command assistant (voice/casual phrasing) | absent |
| `/admin/licenses` | license admin — `organization_licenses` has 4 rows | absent |

`/admin/licenses` is the one to look at first if operators are to be licensed.

### 4. Vendor and investor portals — 6 routes

```
/vendor/dashboard  /vendor/jobs/[id]  /vendor/ledger
/investor/dashboard  /investor/ledger  /investor/contact
```

Canon has `/vendor` and `/investor` as single pages. The legacy versions were
full portals with job assignment and ledgers.

Also absent: `/portals` (portal directory), `/marketplace`, `/track`.

---

## Recommended order

1. **Venture scoping.** The database enforces tenancy already; the UI cannot
   express it. Nothing else about multi-operator works until this does.
2. **`/admin/licenses`.** Small, and it gates operator onboarding.
3. **Dealer suite.** Largest surface — scope it as its own project.
4. **Vendor/investor portals.** Lowest urgency; the single pages work today.

Do not port by copying. The legacy code is on an unrelated history, predates the
current RLS model, and calls tables the canon schema has since changed. Treat
these routes as a **specification of intent**, not a source to merge.
