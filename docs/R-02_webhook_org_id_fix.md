# R-02 · Webhook `OrgRowShapeError` — organization id validation fix

**Status:** DONE — VERIFIED 2026-09-07 in the repo: the fix already landed on `master` in commit `e57e22ea` ("fix(leads): accept the org ids that actually exist"). `src/lib/agent/tenant.ts` `OrgIdSchema` is format-only exactly as §2.1 proposes, and the slug lookup already uses `partner_app_slug`. The regression test lives in open PR #188 (`test/org-id-regression`). The design below is kept as the record of why.
**Track:** P0 remediation (separate from S3-03 … S3-07).
**Authorization needed:** "AUTHORIZED: R-02 — app patch to `tmmt-ops` (branch, not master)".

---

## 1. Root cause — VERIFIED 2026-09-07

The webhook handlers in `tmmt-ops` validate `organizations.id` as a strict RFC-4122 UUID (version/variant nibbles checked). Three seeded organizations use *placeholder-shaped* ids that are syntactically valid UUIDs but fail the strict check:

| id | name | partner_app_slug |
|---|---|---|
| `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` | AIXMOS | `aixmos` |
| `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` | AIXMOS Credit | — |
| `cccccccc-cccc-cccc-cccc-cccccccccccc` | Operation Overdrive | — |

These ids are **intentional and load-bearing**: 96 foreign keys reference `organizations`, and the `aaaa…` id is embedded in 3,090 `audit_events`, 2 installations, 1 license and 1 function default. PostgreSQL's `uuid` type accepts them; only the application refuses them.

The fix therefore belongs in the **application validator/lookup**, not in the data. Re-keying the organizations would touch 96 FK relationships and thousands of historical rows for zero business benefit.

## 2. Proposed fix (application layer, `tmmt-ops`)

1. **Relax the org-id check to format-only.** Replace the strict RFC-4122 regex (`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) with a *format* regex that mirrors what Postgres accepts: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (case-insensitive). Apply this **only** to the organization-row shape check. Do **not** weaken UUID validation globally (person ids, lead ids, auth ids keep the strict check).
2. **Prefer lookup by `partner_app_slug`.** Where a webhook carries a partner identifier, resolve the organization with `select id from organizations where partner_app_slug = $1` and use the returned `id` verbatim. The app should never re-derive or re-validate an id that came from the database.
3. **Do not add `organizations.slug`.** The column the code expects does not exist; `partner_app_slug` is the existing, populated equivalent. Fix the code's column name, not the schema.
4. **Fail closed, log loudly.** If neither a valid-format id nor a known `partner_app_slug` resolves, return 4xx and write one structured log line with the raw identifier (no payload dump).

## 3. Blast radius

- **Code:** the org-row shape validator and any webhook route that constructs it (grep targets below). One shared helper, ideally one file.
- **Data:** none. No rows change.
- **Behaviour:** the three seeded orgs' webhooks start succeeding; all other organizations (real v4 UUIDs) are unaffected because they already pass the stricter check.
- **Security:** format-only validation still rejects injection-shaped input; the value is only ever used as a bound parameter.

## 4. Data cleanup

None required. Optional hygiene (separate, low priority): set `partner_app_slug` for `bbbb…` and `cccc…` so slug lookup works for all three — BUSINESS POLICY REQUIRED (which slugs?).

## 5. Rollback

Revert the commit. There is no data migration to undo.

## 6. Verification (after deploy to a preview, before master)

1. Unit test: validator accepts `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, accepts a real v4 id, rejects `not-a-uuid`, rejects `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa` (35 chars).
2. Unit test: lookup by `partner_app_slug = 'aixmos'` returns the `aaaa…` id.
3. Replay one previously failing webhook against the preview deployment; expect 2xx and a new row in the target table with `org_id = aaaa…`.
4. Vercel runtime logs: zero `OrgRowShapeError` over 24 h after promotion.

## 7. Production risk

Low. No schema change, no data change, code path only executed for webhook ingestion. Main risk is regressing *other* validators if the relaxation is applied globally — hence the explicit scoping in §2.1.

## 8. Repo evidence still required (READ-ONLY, when repo access is available)

```
rg -n "OrgRowShapeError|isUuid|uuidRegex|validateUuid" --type ts
rg -n "organizations?\.(slug|partner_app_slug)" --type ts
rg -n "from\('organizations'\)" --type ts
```

Report the file paths and the exact regex found; the patch is written against those lines, not against assumptions.
