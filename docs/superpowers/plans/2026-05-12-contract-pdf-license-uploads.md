# Contract PDF and driver license uploads — implementation plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Track steps with `- [ ]` checkboxes when executing.

**Goal:** Staff can attach a signed **contract PDF** and **driver license** images (front/back) on **background checks** and **active customers**; customers can upload licenses via a **token link** without login. Files live in **Supabase Storage**; Postgres stores **object paths**; previews use **signed URLs**.

**Architecture:** Private bucket `staff-documents` (already exists in production; add **`storage.objects` RLS policies** using `public.is_staff()` — there are currently **zero** policies, so JWT-based Storage access fails until added). Prefer **new `text` path columns** rather than reusing legacy `background_checks.driver_s_license` **jsonb** (Airtable attachment URLs expire). Optional: server uploads via **service role** after token validation for the public form.

**Tech stack:** Next.js App Router, existing `createSSRClient` / `adminUpsert`, `public.is_staff()` from partner migration, Supabase Storage.

**Live Supabase notes (MCP, 2026-05):** `contracts` has both `contract_status` and `status`; `staff-documents` bucket exists; `is_staff` / `partner_fleet_access` present; `employee_access_rights` has RLS disabled — separate hardening task.

---

## 1. Database migration (SQL)

Add nullable columns (names can match app constants):

| Table | Columns |
|--------|---------|
| `contracts` | `contract_pdf_storage_path` text, optional `contract_pdf_uploaded_at` timestamptz |
| `background_checks` | `drivers_license_front_path`, `drivers_license_back_path` text; `license_upload_token` uuid; `license_upload_token_expires_at` timestamptz |
| `active_customers` | same four columns as background_checks |

Optional: partial unique indexes on `license_upload_token` WHERE NOT NULL.

Ship as new file under `supabase/migrations/` and run in Supabase SQL Editor or pipeline.

---

## 2. Storage policies (Supabase SQL)

On `storage.objects` for `bucket_id = 'staff-documents'`:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE` for role `authenticated` with `USING` / `WITH CHECK` including `public.is_staff()`.

Do **not** grant broad `anon` write; public uploads go through **server action** + service role (or narrow pattern if you change approach later).

---

## 3. Server code

- Server-only helper: service-role Supabase client (isolated module), object key helpers, MIME + max size validation.
- Server actions, e.g. `src/app/(admin)/document-actions.ts` (or split by domain):
  - Staff: contract PDF upload/replace/remove; license image upload; **generate license upload URL** (set token + expiry; return full URL for `/forms/license-upload`).
  - Public: zod-validated action — validate token + row + expiry → upload → write paths → clear token.
- **`middleware.ts`:** rate-limit new public POST route like existing `/forms` POST.

---

## 4. Admin UI

- **Contracts:** [`src/app/(admin)/contracts/page.tsx`](../../../src/app/(admin)/contracts/page.tsx) and [`src/app/(admin)/interfaces/contracts/page.tsx`](../../../src/app/(admin)/interfaces/contracts/page.tsx) — PDF control + align field names with live `contracts` columns.
- **Background checks:** [`src/app/(admin)/background-checks/page.tsx`](../../../src/app/(admin)/background-checks/page.tsx) — front/back, previews, copy upload link.
- **Active customers:** [`src/app/(admin)/customers/page.tsx`](../../../src/app/(admin)/customers/page.tsx) — same pattern.

---

## 5. Public form

- New route under `src/app/forms/` (mirror zod + server action pattern from [`src/app/forms/actions.ts`](../../../src/app/forms/actions.ts)).
- Page: `license-upload` (or similar) reading token from query string.

---

## 6. CSP

- [`next.config.ts`](../../../next.config.ts): extend `img-src` (and `connect-src` if required) for `https://*.supabase.co` (or your project host) so signed Storage URLs render in `<img>`.

---

## 7. Verification

- `npm run build`
- Manual: staff PDF + images; token upload; partner cannot access staff tables / Storage as non-staff
- Optional Playwright smoke if env supports Supabase

---

## Task checklist (execution)

- [ ] Migration: new columns + versioned SQL in repo
- [ ] Storage: `storage.objects` policies for `staff-documents` + `is_staff()`
- [ ] `supabase-storage` (or equivalent) server helpers + MIME/size limits
- [ ] Staff + public server actions; middleware rate limit
- [ ] Admin UI: contracts (both), background checks, customers
- [ ] Public `/forms/...` license upload page
- [ ] `next.config.ts` CSP updates
- [ ] Build + manual QA

---

## Execution handoff

**1. Subagent-driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline** — same session, checkpoints between tasks.

Which approach to use is decided when implementation starts.
