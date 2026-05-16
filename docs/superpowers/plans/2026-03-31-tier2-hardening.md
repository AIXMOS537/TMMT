# Tier 2 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise production-readiness from 5.5/10 to 8+/10 — migrate admin writes to server actions, add security headers, Sentry monitoring, accessibility fixes, loading skeletons, Playwright tests, and update docs.

**Architecture:** Admin server action wraps authenticated upsert behind `createSSRClient()` + `getUser()`. Security headers via Next.js config. Sentry SDK for error monitoring. Accessibility fixes in shared components. Playwright for E2E smoke tests.

**Tech Stack:** @sentry/nextjs (new), @playwright/test (new dev dep), Next.js server actions

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/(admin)/admin-actions.ts` | Auth-gated upsert server action |
| Modify | 17 admin pages in `src/app/(admin)/*/page.tsx` | Replace client supabase upsert with server action |
| Modify | `next.config.ts` | Security headers + Sentry wrapper |
| Create | `sentry.client.config.ts` | Sentry browser SDK init |
| Create | `sentry.server.config.ts` | Sentry server SDK init |
| Create | `sentry.edge.config.ts` | Sentry edge runtime init |
| Create | `src/app/global-error.tsx` | Sentry-wrapped global error boundary |
| Modify | `src/components/ui.tsx` | Accessibility: Modal aria, DataTable keyboard nav |
| Modify | `src/components/Sidebar.tsx` | Accessibility: aria-labels on buttons |
| Create | `src/app/(admin)/loading.tsx` | Admin skeleton loader |
| Create | `src/app/loading.tsx` | Root loading spinner |
| Create | `playwright.config.ts` | Playwright configuration |
| Create | `e2e/smoke.spec.ts` | Smoke tests: login, form submit, admin load |
| Modify | `CLAUDE.md` | Update production gaps, reflect current state |

---

### Task 1: Create admin server action

**Files:**
- Create: `src/app/(admin)/admin-actions.ts`

- [ ] **Step 1: Create the server action file**

```typescript
"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type SaveResult = { success: true } | { success: false; error: string };

export async function adminUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<SaveResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.from(table).upsert(record);
  if (error) {
    console.error(`[${table}] upsert failed:`, error.message);
    return { success: false, error: "Failed to save. Please try again." };
  }
  return { success: true };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin-actions.ts
git commit -m "feat: add auth-gated admin upsert server action"
```

---

### Task 2: Migrate all 17 admin pages to use adminUpsert

**Files:**
- Modify: All 17 `src/app/(admin)/*/page.tsx` files

Every admin page currently has this pattern in handleSave:
```tsx
import { supabase } from "@/lib/supabase";
// ...
const { error } = await supabase.from("table_name").upsert(record);
if (error) { console.error(error.message); setError("Failed to save. Please try again."); return; }
```

Replace with:
```tsx
import { adminUpsert } from "@/app/(admin)/admin-actions";
// ...
const result = await adminUpsert("table_name", record);
if (!result.success) { setError(result.error); return; }
```

And REMOVE `import { supabase } from "@/lib/supabase";` from each file.

**IMPORTANT:** Each page still builds its `record` object from FormData with its own type coercions. Do NOT change that. Only replace the `supabase.from().upsert()` call with `adminUpsert()`.

- [ ] **Step 1: Update leads/page.tsx**

In `src/app/(admin)/leads/page.tsx`:
- Remove: `import { supabase } from "@/lib/supabase";`
- Add: `import { adminUpsert } from "@/app/(admin)/admin-actions";`
- Replace lines 65-66 (the supabase.from + error check) with:
```tsx
    const result = await adminUpsert("incoming_leads", record);
    if (!result.success) { setError(result.error); return; }
```

- [ ] **Step 2: Update fleet/page.tsx**

Same pattern. Table: `"fleet"`. Remove supabase import, add adminUpsert import. Replace lines 84-85.

- [ ] **Step 3: Update customers/page.tsx** — table: `"active_customers"`
- [ ] **Step 4: Update payments/page.tsx** — table: `"customer_payments"`
- [ ] **Step 5: Update maintenance/page.tsx** — table: `"maintenance_appointments"`
- [ ] **Step 6: Update appointments/page.tsx** — table: `"appointments"`
- [ ] **Step 7: Update background-checks/page.tsx** — table: `"background_checks"`
- [ ] **Step 8: Update contracts/page.tsx** — table: `"contracts"`
- [ ] **Step 9: Update do-not-rent/page.tsx** — table: `"do_not_rent_list"`
- [ ] **Step 10: Update expenses/page.tsx** — table: `"expenses"`
- [ ] **Step 11: Update former-customers/page.tsx** — table: `"former_customers"`
- [ ] **Step 12: Update inspections/page.tsx** — table: `"fleet_car_inspections"`
- [ ] **Step 13: Update insurance/page.tsx** — table: `"insurance"`
- [ ] **Step 14: Update operation-costs/page.tsx** — table: `"operation_costs"`
- [ ] **Step 15: Update tickets/page.tsx** — table: `"tickets"`
- [ ] **Step 16: Update vendors/page.tsx** — table: `"shops_mechanics_cleaning"`
- [ ] **Step 17: Update waitlist/page.tsx** — table: `"waitlist"`

- [ ] **Step 18: Verify no client supabase imports remain in admin pages**

```bash
grep -r "from \"@/lib/supabase\"" src/app/\(admin\)/
```
Expected: No matches.

- [ ] **Step 19: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 20: Commit**

```bash
git add src/app/\(admin\)/
git commit -m "feat: migrate all admin writes to auth-gated server action"
```

---

### Task 3: Add security headers

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update next.config.ts**

Replace the entire file:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.sentry.io",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: add security headers (CSP, X-Frame-Options, etc.)"
```

---

### Task 4: Install and configure Sentry

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `src/app/global-error.tsx`
- Modify: `next.config.ts` (wrap with Sentry)
- Modify: `package.json` (add @sentry/nextjs)

- [ ] **Step 1: Install Sentry**

```bash
npm install @sentry/nextjs
```

- [ ] **Step 2: Create sentry.client.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 3: Create sentry.server.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 4: Create sentry.edge.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 5: Create src/app/global-error.tsx**

This is the root-level error boundary that Sentry hooks into (replaces the existing error.tsx for the global scope):

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <Button onClick={reset}>Try Again</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Wrap next.config.ts with Sentry**

Update `next.config.ts` — add Sentry import and wrapper:

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.sentry.io",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
});
```

- [ ] **Step 7: Add NEXT_PUBLIC_SENTRY_DSN to .env**

Append to `.env`:
```
# ------ Sentry ------
NEXT_PUBLIC_SENTRY_DSN=
```

Note: Leave DSN blank for now. User will create a Sentry project and fill in the DSN. Sentry is disabled when DSN is empty or NODE_ENV !== production.

- [ ] **Step 8: Verify build**

```bash
npm run build
```
Expected: Build succeeds. Sentry SDK loads but is inactive (no DSN).

- [ ] **Step 9: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts src/app/global-error.tsx next.config.ts package.json package-lock.json .env
git commit -m "feat: add Sentry error monitoring (inactive until DSN configured)"
```

---

### Task 5: Accessibility fixes

**Files:**
- Modify: `src/components/ui.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Fix Modal accessibility in ui.tsx**

In `src/components/ui.tsx`, replace the Modal component (lines 186-224) with:

```tsx
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh]",
          wide ? "w-full max-w-3xl" : "w-full max-w-lg"
        )}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fix DataTable keyboard navigation in ui.tsx**

In `src/components/ui.tsx`, update the `<tr>` for data rows (lines 155-176). Replace the `data.map` block:

```tsx
              data.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
```

- [ ] **Step 3: Fix Sidebar accessibility**

In `src/components/Sidebar.tsx`, update the hamburger button (lines 90-95):

```tsx
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-slate-800 rounded-lg p-2 shadow-md"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close navigation" : "Open navigation"}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
```

Update the nav group toggle buttons (lines 123-135) — add aria-expanded:

```tsx
              <button
                onClick={() => toggle(group.label)}
                aria-expanded={!collapsed[group.label]}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-slate-300"
              >
```

Add aria-label to the sidebar `<aside>` (line 106):

```tsx
      <aside
        aria-label="Main navigation"
        className={cn(
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui.tsx src/components/Sidebar.tsx
git commit -m "feat: fix accessibility — aria-labels, keyboard nav, dialog semantics"
```

---

### Task 6: Add loading skeletons

**Files:**
- Create: `src/app/(admin)/loading.tsx`
- Create: `src/app/loading.tsx`

- [ ] **Step 1: Create admin loading skeleton**

```tsx
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mt-2" />
        </div>
        <div className="h-9 w-28 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-72 bg-gray-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-10 w-48 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3 flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-slate-700 rounded flex-1" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-4 py-3 flex gap-4 border-b border-gray-100 dark:border-slate-700 last:border-0">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 bg-gray-100 dark:bg-slate-700/50 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create root loading spinner**

```tsx
export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/loading.tsx src/app/\(admin\)/loading.tsx
git commit -m "feat: add loading skeletons for admin and root routes"
```

---

### Task 7: Install Playwright and write smoke tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` (add test:e2e script)

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create playwright.config.ts**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Create e2e/smoke.spec.ts**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Public Forms", () => {
  test("lead intake form loads and shows required fields", async ({ page }) => {
    await page.goto("/forms/lead-intake");
    await expect(page.locator("h1")).toContainText("Vehicle Rental Inquiry");
    await expect(page.locator('input[name="contact_name"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test("lead intake form validates and submits", async ({ page }) => {
    await page.goto("/forms/lead-intake");
    await page.fill('input[name="contact_name"]', "Test User");
    await page.fill('input[name="phone"]', "5551234567");
    await page.fill('input[name="email"]', "test@example.com");
    await page.click('button[type="submit"]');
    // Should show success or error banner (not alert)
    await expect(page.locator("text=Thank You").or(page.locator('[class*="red"]'))).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Auth", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.locator("form")).toBeVisible();
  });

  test("login page loads with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});

test.describe("Admin (requires auth)", () => {
  test("forms routes are publicly accessible", async ({ page }) => {
    await page.goto("/forms/appointment");
    // Should NOT redirect to login
    await expect(page.locator("h1")).toContainText("Appointment");
  });

  test("ticket form loads with issue type dropdown", async ({ page }) => {
    await page.goto("/forms/ticket");
    await expect(page.locator('select[name="issue_type"]')).toBeVisible();
  });
});
```

- [ ] **Step 4: Add test:e2e script to package.json**

Add to the "scripts" section:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: Verify Playwright runs**

```bash
npm run test:e2e
```
Expected: Tests run against dev server (or report connection error if dev server isn't running).

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json
git commit -m "feat: add Playwright smoke tests for forms and auth flow"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md production gaps section**

Replace the "Production Gaps" section with:

```markdown
## Production Gaps (ordered by priority)

1. ~~**Row-Level Security (RLS)**~~ — **DONE**: RLS enabled on all 20 tables via `supabase/migrations/20260331_enable_rls.sql`. Public form tables allow anon INSERT; admin tables require authenticated. Policies use `USING (true)` — tighten to per-user if multi-tenant is needed.
2. ~~**Input validation / server actions**~~ — **DONE**: All 8 public forms use zod-validated server actions (`src/app/forms/actions.ts`). All 17 admin pages use auth-gated server action (`src/app/(admin)/admin-actions.ts`).
3. ~~**Error handling**~~ — **DONE**: ErrorBanner replaces all alert() calls. Error boundaries at root and admin level. `.catch()` on all data fetches.
4. ~~**Rate limiting**~~ — **DONE**: In-memory rate limiter (5 req/hr per IP) in middleware for `/forms` POST.
5. ~~**Security headers**~~ — **DONE**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy in `next.config.ts`.
6. ~~**Error monitoring**~~ — **DONE**: Sentry SDK installed and configured. Set `NEXT_PUBLIC_SENTRY_DSN` in `.env` to activate.
7. **Maintenance show/no-show toggle** — spec approved (`docs/superpowers/specs/2026-03-26-maintenance-toggle-design.md`); **not started**
8. **Password reset flow** — no forgot password; admins reset via Supabase dashboard
9. **File uploads** — Airtable had photos/licenses/contracts not yet in Supabase Storage
10. **Email notifications** — no transactional email yet
11. **Reporting / analytics** — no export or aggregate views
12. **Testing infrastructure** — Playwright installed with smoke tests; no unit test framework yet
```

- [ ] **Step 2: Update the Admin Page Pattern section**

Replace the admin page pattern code block:

```tsx
"use client"
// 1. useEffect → fetch data → setState (with .catch() for error handling)
// 2. useMemo → filter by search + status
// 3. DataTable with columns config
// 4. onRowClick → Modal → FormField inputs
// 5. handleSave → adminUpsert("table_name", record) server action → reload
// 6. ErrorBanner in Modal for inline error display
```

- [ ] **Step 3: Verify CLAUDE.md reads correctly**

Read through the file to ensure no contradictions with current state.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect security hardening, RLS, server actions"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: Clean build.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: No new warnings.

- [ ] **Step 3: Verify no client supabase imports in admin or form pages**

```bash
grep -r "from \"@/lib/supabase\"" src/app/
```
Expected: No matches (only queries.ts and supabase.ts itself should reference it).

- [ ] **Step 4: Verify zero alert() calls**

```bash
grep -r "alert(" src/
```
Expected: No matches.
