# TMMT `.net`-Only Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip `.com` host handling from the existing TMMT Next.js app so it only serves the staff-only `.net` domain. This is the hard prerequisite for Phase 3 of [`docs/superpowers/plans/2026-05-20-aixmos-domain-architecture.md`](2026-05-20-aixmos-domain-architecture.md).

**Architecture:** 6 phases, TDD-shaped where the runtime is testable. E2E tests (Playwright, already configured) verify middleware behavior end-to-end. Static asset removal is mechanical and verified by `npm run build`. Each phase ends with a focused commit.

**Tech Stack:** Next.js 16 App Router, TypeScript, Playwright E2E (`e2e/`, webServer auto-boots `npm run dev` on port 3000), Supabase auth (unchanged).

**Spec reference:** `docs/superpowers/specs/2026-05-20-aixmos-domain-architecture-design.md`

---

## Scope

**In scope:**
1. `middleware.ts` — remove `.com` host detection, change unauthenticated login redirect from `aioms.com/login` to local `/login`, add `X-Robots-Tag: noindex, nofollow` header on every response
2. `src/lib/site-domains.ts` — remove `PUBLIC_SITE_HOST`, `isPublicSiteHost`, `publicSiteOrigin` (no longer used); keep `OWNER_HUB_HOST`, `normalizeHost`, `isOwnerHubHost`, `ownerHubOrigin`
3. `public/robots.txt` — create new with `User-agent: *\nDisallow: /`
4. Delete `AIXMOS/public/` (legacy candidate-deploy directory, never served)
5. Delete `public/aixmos/` (the directory the middleware currently rewrites `.com` apex to)
6. Remove the `prebuild` script and `scripts/generate-ghl-config.mjs` (generates `public/aixmos/ghl-config.js` which won't be served anymore)
7. Update `.env.example` to remove `NEXT_PUBLIC_PUBLIC_SITE_HOST` (keep `NEXT_PUBLIC_OWNER_HUB_HOST`)

**Out of scope (deferred):**
- Deleting `/forms/*` public routes (depends on GHL→webhook integration design)
- Removing rate limit logic for `/forms` POST
- Deeper env var cleanup (e.g., `NEXT_PUBLIC_GHL_*` variables that may still be referenced elsewhere)
- Subdomain-based host routing for `admin.tmmtrentals.net` (treated as future enhancement, not a migration blocker)

---

## File Structure

| File | Action |
|---|---|
| `middleware.ts` | Modify (lines 1-129) |
| `src/lib/site-domains.ts` | Modify (lines 1-29) |
| `public/robots.txt` | Create |
| `AIXMOS/public/` | Delete (directory) |
| `public/aixmos/` | Delete (directory) |
| `scripts/generate-ghl-config.mjs` | Delete (file) |
| `package.json` | Modify (remove `prebuild` script) |
| `.env.example` | Modify (remove `NEXT_PUBLIC_PUBLIC_SITE_HOST` line) |
| `e2e/net-only-refactor.spec.ts` | Create (new E2E tests for the refactor) |

---

## Phase 1: Add failing E2E tests for target behavior

The tests define the contract. Write them first, run them, watch them fail because the current code does the old behavior. Then Phase 2 makes them pass.

### Task 1.1: Write E2E tests for new middleware behavior

**Files:**
- Create: `e2e/net-only-refactor.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `e2e/net-only-refactor.spec.ts` with this exact content:

```typescript
import { test, expect } from "@playwright/test";

test.describe("net-only refactor — middleware behavior", () => {
  test("X-Robots-Tag header is present on every response", async ({ request }) => {
    const response = await request.get("/login");
    const header = response.headers()["x-robots-tag"];
    expect(header).toBeDefined();
    expect(header).toContain("noindex");
    expect(header).toContain("nofollow");
  });

  test("X-Robots-Tag is present on apex too", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    // Apex unauthenticated redirects; the redirect response should still carry the header
    const header = response.headers()["x-robots-tag"];
    expect(header).toBeDefined();
    expect(header).toContain("noindex");
  });

  test("unauthenticated request to protected path redirects to local /login (not cross-domain)", async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.goto("/command", { waitUntil: "commit" });
    // Final URL must be on localhost (the dev origin) — NOT a cross-domain redirect
    expect(page.url()).toMatch(/^http:\/\/localhost:3000\/login/);
    expect(page.url()).not.toContain("allinonemanagementsolutions");
  });

  test("robots.txt blocks all crawlers", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /");
  });

  test("legacy /aixmos/* static paths return 404 (no longer served)", async ({ request }) => {
    const response = await request.get("/aixmos/index.html");
    expect(response.status()).toBe(404);
  });
});
```

- [ ] **Step 2: Run the new tests — they MUST fail**

Run:
```bash
cd /Users/ceo.moe/TMMT && npx playwright test e2e/net-only-refactor.spec.ts --reporter=list
```

Expected (failing — confirms TDD baseline):
- `X-Robots-Tag header is present` → FAIL (header doesn't exist in current middleware)
- `X-Robots-Tag is present on apex too` → FAIL (same reason)
- `unauthenticated request to /command redirects to local /login` — likely passes already (existing middleware redirects to `/login` on `request.url`), but verify
- `robots.txt blocks all crawlers` → FAIL (file doesn't exist; returns 404)
- `legacy /aixmos/* static paths return 404` → FAIL (currently served from `public/aixmos/`)

If ALL tests fail, you've baselined correctly. If some pass, that's fine — it means the existing code already meets part of the contract. Move on.

- [ ] **Step 3: Commit the failing tests**

```bash
git add e2e/net-only-refactor.spec.ts
git commit -m "Add failing E2E tests for .net-only refactor (TDD baseline)"
```

---

## Phase 2: Middleware refactor

Make the failing middleware-related tests pass. Three sub-tasks: add header, change login redirect, remove `.com` branches.

### Task 2.1: Add `X-Robots-Tag` header to every response

**Files:**
- Modify: `middleware.ts:53-56` (function body start)

- [ ] **Step 1: Edit middleware.ts to set the header on the response**

In `middleware.ts`, find the line:
```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
```

Add immediately after the `const response = ...` line:
```typescript
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
```

**Important:** the header must also be set on `redirect()` and `rewrite()` responses returned later in the function. Easier pattern — define a helper at top of the function:

Use this Edit:
- Find:
```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
```

- Replace with:
```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  // Helper: ensure every response we return carries the noindex header.
  const withRobotsHeader = (res: NextResponse): NextResponse => {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  };

  const { pathname } = request.nextUrl;
```

- [ ] **Step 2: Wrap every `NextResponse.redirect()` / `NextResponse.rewrite()` / `NextResponse.json()` call in `withRobotsHeader(...)`**

Do a find/replace across `middleware.ts`:
- `return NextResponse.redirect(` → `return withRobotsHeader(NextResponse.redirect(`
- `return NextResponse.rewrite(` → `return withRobotsHeader(NextResponse.rewrite(`
- `return NextResponse.json(` → `return withRobotsHeader(NextResponse.json(`

Then close the parentheses appropriately on each line. There are approximately 6 such return statements based on the current code.

- [ ] **Step 3: Verify with the E2E header tests**

Run:
```bash
npx playwright test e2e/net-only-refactor.spec.ts -g "X-Robots-Tag" --reporter=list
```

Expected: both `X-Robots-Tag` tests pass.

- [ ] **Step 4: Commit the header addition**

```bash
git add middleware.ts
git commit -m "Add X-Robots-Tag header on all middleware responses

Defense-in-depth noindex enforcement per the domain architecture spec.
Header is set on the default NextResponse.next() response and wrapped
around every redirect/rewrite/json return via withRobotsHeader()."
```

### Task 2.2: Change cross-domain login redirect to local `/login`

**Files:**
- Modify: `middleware.ts:97` and `middleware.ts:104` (two `publicSiteOrigin()` redirects)

- [ ] **Step 1: Edit the first cross-domain redirect**

Find in `middleware.ts`:
```typescript
return NextResponse.redirect(new URL("/login?hub=owner", publicSiteOrigin()));
```

This appears twice (line ~97 and line ~104 in the current code). Replace BOTH occurrences with:
```typescript
return NextResponse.redirect(new URL("/login?hub=owner", request.url));
```

The change: `publicSiteOrigin()` → `request.url`. This keeps the redirect on the same origin (`.net`) instead of jumping to `.com`.

- [ ] **Step 2: Verify with the cross-domain test**

Run:
```bash
npx playwright test e2e/net-only-refactor.spec.ts -g "redirects to local /login" --reporter=list
```

Expected: passes.

- [ ] **Step 3: Verify the existing smoke tests still pass**

Run:
```bash
npx playwright test e2e/smoke.spec.ts --reporter=list
```

Expected: all existing smoke tests still pass. If any auth-related tests fail, the redirect change broke something — investigate before continuing.

- [ ] **Step 4: Commit the login redirect change**

```bash
git add middleware.ts
git commit -m "Change unauthenticated redirect from .com cross-domain to local /login

After the GHL migration, allinonemanagementsolutions.com will not host
a /login page. Keep the redirect on the same origin so .net stays
self-contained."
```

### Task 2.3: Remove `.com`-only middleware branches

**Files:**
- Modify: `middleware.ts` (multiple locations)

The current middleware has branches for `isPublicSiteHost` / `publicSite` that handle `.com`-specific behavior. With `.com` moving to GHL, these branches are dead code. Remove them carefully.

- [ ] **Step 1: Remove the AIXMOS static rewrite branch**

Find and DELETE:
```typescript
  if (publicSite && pathname === "/" && !ownerHub && !user) {
    return NextResponse.rewrite(new URL("/aixmos/index.html", request.url));
  }
```

(Note: this may already be wrapped in `withRobotsHeader(...)` from Task 2.1. Delete the whole block including wrapper.)

- [ ] **Step 2: Remove `.com`-only forms-redirect branch**

Find:
```typescript
  // Public intake forms live on .com only — not the private .net owner hub.
  if (ownerHub && pathname.startsWith("/forms")) {
    return NextResponse.redirect(new URL(pathname, publicSiteOrigin()));
  }
```

DELETE this entire block. Reasoning: `.com` won't have `/forms/*` after GHL migration; if forms are submitted by staff on `.net` (vs. GHL funnels), they stay on `.net`. (If `/forms/*` should be removed entirely, that's the deferred out-of-scope cleanup.)

- [ ] **Step 3: Remove the `isAixmosStaticPath` helper and its callers**

The helper function `isAixmosStaticPath` at the top of `middleware.ts` is dead. Delete it:
```typescript
function isAixmosStaticPath(pathname: string) {
  return (
    pathname.startsWith("/aixmos") ||
    pathname === "/apply" ||
    pathname === "/operator-apply" ||
    pathname === "/thankyou"
  );
}
```

Then update `isPublicPath` to remove the `isAixmosStaticPath(pathname)` call. New `isPublicPath`:
```typescript
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/login/")
  );
}
```

(`/forms/*` stays public because the forms still exist locally until separately removed.)

- [ ] **Step 4: Remove the `isPublicSiteHost` / `publicSite` variable usage**

Find:
```typescript
import {
  isOwnerHubHost,
  isPublicSiteHost,
  publicSiteOrigin,
} from "@/lib/site-domains";
```

Replace with:
```typescript
import { isOwnerHubHost } from "@/lib/site-domains";
```

Find:
```typescript
  const publicSite = isPublicSiteHost(host);
```

Delete this line.

- [ ] **Step 5: Simplify the matcher to remove `aixmos/` exclusion**

Find at bottom of `middleware.ts`:
```typescript
export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|aixmos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html)$).*)",
  ],
};
```

Replace with:
```typescript
export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html)$).*)",
  ],
};
```

The `aixmos/|` segment is removed because that path is no longer served.

- [ ] **Step 6: Verify the legacy-paths-404 test now passes**

Run:
```bash
npx playwright test e2e/net-only-refactor.spec.ts -g "legacy /aixmos" --reporter=list
```

Expected: passes. (After Phase 3 deletes the actual files, this will further solidify, but the middleware change alone may not yet cause 404 — Next.js still serves `public/aixmos/` as static files. Skip this expectation for now; revisit after Phase 3.)

- [ ] **Step 7: Verify full test suite**

Run:
```bash
npx playwright test --reporter=list
```

Expected: all tests pass except possibly `legacy /aixmos/* static paths return 404` (deferred to Phase 3).

- [ ] **Step 8: Verify build still succeeds**

Run:
```bash
npm run build
```

Expected: build succeeds. Watch for TypeScript errors from the removed imports — if `isPublicSiteHost`/`publicSiteOrigin` are still imported anywhere else in `src/`, those callers need updating.

- [ ] **Step 9: Find and fix any remaining callers of removed helpers**

Run:
```bash
grep -rn "isPublicSiteHost\|publicSiteOrigin\|PUBLIC_SITE_HOST" src/ middleware.ts 2>&1 | grep -v "node_modules"
```

Expected: no results, or only the definitions inside `src/lib/site-domains.ts` (which we'll remove in Task 2.4).

If callers exist, update each to either remove the cross-domain logic or use `request.url` as the origin instead.

- [ ] **Step 10: Commit**

```bash
git add middleware.ts
git commit -m "Remove .com host detection from middleware

The app now serves only the .net staff hub; .com lives on GHL.
Removes:
- /aixmos/index.html rewrite for .com apex
- /forms redirect from .net to .com
- isAixmosStaticPath helper and its callers
- isPublicSiteHost / publicSite variable
- aixmos/ exclusion from the matcher

Updates isPublicPath to drop the AIXMOS static-path branch."
```

### Task 2.4: Simplify `src/lib/site-domains.ts`

**Files:**
- Modify: `src/lib/site-domains.ts:1-29`

- [ ] **Step 1: Remove dead exports**

Replace the entire contents of `src/lib/site-domains.ts` with:

```typescript
/** Host helpers for the .net owner hub (TMMT staff app). */

export const OWNER_HUB_HOST =
  process.env.NEXT_PUBLIC_OWNER_HUB_HOST ?? "tmmtrentals.net";

export function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isOwnerHubHost(host: string | null): boolean {
  const h = normalizeHost(host);
  return h === OWNER_HUB_HOST || h === `www.${OWNER_HUB_HOST}`;
}

export function ownerHubOrigin(): string {
  return `https://${OWNER_HUB_HOST}`;
}
```

Changes:
- Removed `PUBLIC_SITE_HOST`, `isPublicSiteHost`, `publicSiteOrigin`
- Updated default for `OWNER_HUB_HOST` from `allinonemanagementsolutions.net` → `tmmtrentals.net` (the new home per the spec)

- [ ] **Step 2: Verify no remaining callers**

Run:
```bash
grep -rn "PUBLIC_SITE_HOST\|isPublicSiteHost\|publicSiteOrigin" src/ middleware.ts 2>&1 | grep -v "node_modules"
```

Expected: no results.

- [ ] **Step 3: Build and test**

Run:
```bash
npm run build && npx playwright test --reporter=list
```

Expected: build passes, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/site-domains.ts
git commit -m "Simplify site-domains.ts — remove .com cross-domain helpers

After middleware no longer references the public site, PUBLIC_SITE_HOST,
isPublicSiteHost, and publicSiteOrigin are dead code. Also updates the
OWNER_HUB_HOST default from aioms.net to tmmtrentals.net to reflect
the new .net home for the rental admin."
```

---

## Phase 3: Remove AIXMOS static assets

The AIXMOS public landing/intake pages move to GHL. Static files in this repo no longer serve any purpose.

### Task 3.1: Delete `AIXMOS/public/` (legacy candidate-deploy directory)

**Files:** Delete `AIXMOS/public/` (recursive).

- [ ] **Step 1: Confirm contents before deletion**

Run:
```bash
ls /Users/ceo.moe/TMMT/AIXMOS/public/
```

Expected: directory exists with files like `index.html`, `apply.html`, `operator.html`, `thankyou.html`, `ghl-config.js`, `vercel.json`. Note exact contents in case a file is unexpectedly important.

- [ ] **Step 2: Confirm no source code references `AIXMOS/public`**

Run:
```bash
grep -rn "AIXMOS/public" /Users/ceo.moe/TMMT/src /Users/ceo.moe/TMMT/middleware.ts /Users/ceo.moe/TMMT/scripts /Users/ceo.moe/TMMT/next.config.ts /Users/ceo.moe/TMMT/package.json 2>&1 | grep -v "node_modules"
```

Expected: no results. If results exist, investigate and update callers before deletion.

- [ ] **Step 3: Delete the directory**

Run:
```bash
rm -rf /Users/ceo.moe/TMMT/AIXMOS/public
```

- [ ] **Step 4: Verify build still succeeds**

Run:
```bash
npm run build
```

Expected: build succeeds.

### Task 3.2: Delete `public/aixmos/` (the served directory)

**Files:** Delete `public/aixmos/` (recursive).

- [ ] **Step 1: Confirm contents before deletion**

Run:
```bash
ls /Users/ceo.moe/TMMT/public/aixmos/
```

Expected: directory exists with `index.html`, `apply.html`, `operator.html`, `thankyou.html`, `ghl-config.js`, etc.

- [ ] **Step 2: Confirm no source code references `public/aixmos` or `/aixmos/`**

Run:
```bash
grep -rn "/aixmos/" /Users/ceo.moe/TMMT/src /Users/ceo.moe/TMMT/middleware.ts /Users/ceo.moe/TMMT/scripts /Users/ceo.moe/TMMT/next.config.ts 2>&1 | grep -v "node_modules" | grep -v "\.html"
```

Expected: no results (the middleware references were removed in Task 2.3).

- [ ] **Step 3: Delete the directory**

Run:
```bash
rm -rf /Users/ceo.moe/TMMT/public/aixmos
```

- [ ] **Step 4: Verify the legacy-paths test now passes**

Start a fresh dev server (kill any existing one):
```bash
npx playwright test e2e/net-only-refactor.spec.ts -g "legacy /aixmos" --reporter=list
```

Expected: passes (404 returned for `/aixmos/index.html`).

- [ ] **Step 5: Verify build still succeeds**

Run:
```bash
npm run build
```

Expected: build succeeds.

### Task 3.3: Remove `prebuild` script and `scripts/generate-ghl-config.mjs`

**Files:**
- Modify: `package.json` (remove `prebuild` script entry)
- Delete: `scripts/generate-ghl-config.mjs`

- [ ] **Step 1: Confirm `prebuild` is no longer needed**

The `prebuild` script generates `public/aixmos/ghl-config.js`. Now that `public/aixmos/` is gone, this is dead. Confirm no other code depends on `ghl-config.js`:

Run:
```bash
grep -rn "ghl-config" /Users/ceo.moe/TMMT/src 2>&1 | grep -v "node_modules"
```

Expected: no results in `src/` (the file was only consumed by AIXMOS landing pages, now removed).

- [ ] **Step 2: Remove `prebuild` from `package.json`**

In `package.json`, find:
```json
"prebuild": "node scripts/generate-ghl-config.mjs",
```

Delete this line entirely. Ensure trailing comma on the previous line is correct JSON.

- [ ] **Step 3: Delete the script**

Run:
```bash
rm /Users/ceo.moe/TMMT/scripts/generate-ghl-config.mjs
```

- [ ] **Step 4: Verify build (no prebuild step now)**

Run:
```bash
npm run build
```

Expected: build succeeds. No "prebuild" hook executes.

### Task 3.4: Commit Phase 3

- [ ] **Step 1: Stage deletions and edits**

Run:
```bash
git add -A AIXMOS/public public/aixmos scripts/generate-ghl-config.mjs package.json
git status --porcelain | head -20
```

Expected: shows `D` (deleted) entries for `AIXMOS/public/*`, `public/aixmos/*`, `scripts/generate-ghl-config.mjs`, and `M` for `package.json`.

- [ ] **Step 2: Commit**

```bash
git commit -m "Remove AIXMOS static assets — content now lives in GHL

Deletes:
- AIXMOS/public/        (legacy candidate-deploy directory)
- public/aixmos/        (the directory middleware rewrote .com apex to)
- scripts/generate-ghl-config.mjs (prebuild script for ghl-config.js)

Removes the prebuild step from package.json. The .com sites now live
on GHL, so all landing/intake content moves there."
```

---

## Phase 4: Create `robots.txt`

### Task 4.1: Create `public/robots.txt`

**Files:** Create `public/robots.txt`.

- [ ] **Step 1: Create the file**

Create `public/robots.txt` with this exact content:

```
User-agent: *
Disallow: /
```

Two lines. No trailing whitespace, single trailing newline.

- [ ] **Step 2: Verify the robots.txt test passes**

Run:
```bash
npx playwright test e2e/net-only-refactor.spec.ts -g "robots.txt" --reporter=list
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "Add robots.txt blocking all crawlers on .net

Third layer of noindex defense (after X-Robots-Tag header and meta tag).
The .net domain hosts staff-only content and must never appear in
search results."
```

---

## Phase 5: Update `.env.example`

### Task 5.1: Remove `NEXT_PUBLIC_PUBLIC_SITE_HOST` from `.env.example`

**Files:** Modify `.env.example`.

- [ ] **Step 1: Find and remove the line**

Open `.env.example`. Find any line like:
```
NEXT_PUBLIC_PUBLIC_SITE_HOST=allinonemanagementsolutions.com
```

Delete that line. Also delete any associated comment that exclusively documents this variable.

If a similar `NEXT_PUBLIC_OWNER_HUB_HOST` line exists, update its default to `tmmtrentals.net` (matching the new default in `site-domains.ts`).

- [ ] **Step 2: Verify `npm run check-env` (if available) still works**

Run:
```bash
npm run check-env 2>&1 | head -20
```

Expected: script runs without missing-variable errors for the public site host (since it's no longer required).

If `check-env.mjs` references `NEXT_PUBLIC_PUBLIC_SITE_HOST`, edit that script too to remove the reference.

- [ ] **Step 3: Commit**

```bash
git add .env.example scripts/check-env.mjs
git commit -m "Remove NEXT_PUBLIC_PUBLIC_SITE_HOST — no longer used

The app now serves only .net; cross-domain helpers were removed in
the prior commits. Drop the env var from .env.example and check-env."
```

---

## Phase 6: Final verification

### Task 6.1: Run the full test suite

**Files:** None.

- [ ] **Step 1: All E2E tests pass**

Run:
```bash
npx playwright test --reporter=list
```

Expected: all tests in `e2e/smoke.spec.ts`, `e2e/venture-routes.spec.ts`, and `e2e/net-only-refactor.spec.ts` pass.

- [ ] **Step 2: Production build succeeds**

Run:
```bash
npm run build
```

Expected: build completes, no errors, no warnings about missing static files.

- [ ] **Step 3: Lint passes**

Run:
```bash
npm run lint
```

Expected: no errors. Possible warnings about unused imports — fix if directly related to the refactor.

### Task 6.2: Manual verification against a running dev server

**Files:** None.

- [ ] **Step 1: Start dev server**

Run:
```bash
npm run dev
```

(In a separate terminal.)

- [ ] **Step 2: Verify X-Robots-Tag header on a few paths**

Run:
```bash
curl -sI http://localhost:3000/login | grep -i x-robots-tag
curl -sI http://localhost:3000/ | grep -i x-robots-tag
curl -sI http://localhost:3000/robots.txt | grep -i x-robots-tag
```

Expected: all three include `X-Robots-Tag: noindex, nofollow, noarchive`.

(Note: the robots.txt response itself doesn't strictly need the header since the body already says Disallow, but having it doesn't hurt.)

- [ ] **Step 3: Verify robots.txt content**

Run:
```bash
curl -s http://localhost:3000/robots.txt
```

Expected:
```
User-agent: *
Disallow: /
```

- [ ] **Step 4: Verify legacy `/aixmos/*` paths 404**

Run:
```bash
curl -sI http://localhost:3000/aixmos/index.html | head -1
curl -sI http://localhost:3000/aixmos/ghl-config.js | head -1
```

Expected: both return `HTTP/1.1 404 Not Found`.

- [ ] **Step 5: Verify unauthenticated user gets local /login redirect (not cross-domain)**

User action: in browser incognito, visit `http://localhost:3000/command`. Should redirect to `http://localhost:3000/login` — NOT to `allinonemanagementsolutions.com/login`.

- [ ] **Step 6: Stop dev server**

User action: Ctrl+C in the dev terminal.

### Task 6.3: Deploy and verify on Vercel preview

The Vercel project `tmmt-c919` auto-deploys on push. After the final commit lands:

- [ ] **Step 1: Push the branch**

Run:
```bash
git push origin cursor/aixmos-cube-production
```

Expected: push succeeds. Vercel creates a preview deployment.

- [ ] **Step 2: Find the preview URL in Vercel dashboard**

User action: Vercel → `tmmt-c919` → Deployments → click the latest. Copy the preview URL (something like `tmmt-c919-git-cursor-...vercel.app`).

- [ ] **Step 3: Verify production-like behavior on the preview**

Run (substituting the preview URL):
```bash
PREVIEW_URL=<your preview url>
curl -sI $PREVIEW_URL | grep -i x-robots-tag
curl -s $PREVIEW_URL/robots.txt
curl -sI $PREVIEW_URL/aixmos/index.html | head -1
```

Expected:
- `X-Robots-Tag: noindex, nofollow, noarchive` present
- `robots.txt` shows `User-agent: * / Disallow: /`
- `/aixmos/index.html` returns 404

- [ ] **Step 4: Merge to production branch**

User action: Open a PR (or fast-forward merge per your branch convention) from `cursor/aixmos-cube-production` to your production branch. After merge, Vercel auto-deploys production.

Expected: production deploy completes successfully.

- [ ] **Step 5: Verify production behavior on `https://allinonemanagementsolutions.net`**

Note: `allinonemanagementsolutions.net` is still attached to `tmmt-c919` at this point (it gets detached in Task 2.2 of the infrastructure plan). The refactor will be visible on it.

Run:
```bash
curl -sI https://allinonemanagementsolutions.net | grep -i x-robots-tag
curl -s https://allinonemanagementsolutions.net/robots.txt
curl -sI https://allinonemanagementsolutions.net/aixmos/index.html | head -1
```

Expected: all match the preview-URL behavior above.

**The refactor is now complete.** Task 1.3 of the infrastructure plan (`docs/superpowers/plans/2026-05-20-aixmos-domain-architecture.md`) can now be marked as satisfied. Proceed to Phase 2 of the infrastructure plan.

---

## Rollback

This refactor is fully reversible via `git revert` of the Phase 2–5 commits. The deleted static assets can be restored from git history if needed.

| Phase | Reversibility |
|---|---|
| 1 (test additions) | Just `git revert` the test commit |
| 2 (middleware) | `git revert` each of the 4 commits in Phase 2 |
| 3 (static deletions) | `git revert` restores `AIXMOS/public/`, `public/aixmos/`, and `scripts/generate-ghl-config.mjs` |
| 4 (robots.txt) | Delete `public/robots.txt` |
| 5 (.env.example) | `git revert` |
| 6 (verification) | No state changes — nothing to revert |

If a production deploy after Phase 6 misbehaves: roll back the production branch to the prior commit. The Vercel project will auto-redeploy.

---

## Out-of-scope follow-ups

After this refactor, the following items remain for future plans:

1. **`/forms/*` route removal** — if forms move entirely to GHL with webhooks, the local routes and rate limit logic become dead. Its own small plan.
2. **`admin.tmmtrentals.net` subdomain routing** — middleware could detect `admin.` host and rewrite to `/admin` paths. Plan when those routes exist.
3. **Cleanup of `NEXT_PUBLIC_GHL_*` env vars** — if no longer used after `ghl-config.js` removal. Audit and remove.
4. **`docs/DOMAIN-SETUP.md` deprecation** — handled in Phase 8 of the infrastructure plan, not here.
