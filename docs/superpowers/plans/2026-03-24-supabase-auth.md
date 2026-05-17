# Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email + password authentication to TMMT Rentals so all admin routes require a valid Supabase session, while public forms remain accessible.

**Architecture:** Next.js middleware at the project root checks session via `supabase.auth.getUser()` on every request and redirects unauthenticated users to `/login`. Admin pages are reorganized into an `(admin)` route group (with Sidebar layout) and a new `(auth)` route group hosts the login page (no Sidebar). Two Supabase SSR helpers handle cookie-based sessions: one for middleware, one for server actions.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr` v0.9.0, `@supabase/supabase-js` v2.97.0, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-24-supabase-auth-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/lib/supabase.ts` | Add `createSSRClient()` and `createMiddlewareClient()` helpers |
| Create | `middleware.ts` (project root) | Auth gate: check session, redirect, propagate cookies |
| Modify | `src/app/layout.tsx` | Strip to bare shell — remove Sidebar |
| Create | `src/app/(auth)/layout.tsx` | Minimal layout for login page (no Sidebar) |
| Create | `src/app/(auth)/login/page.tsx` | Email + password login form |
| Create | `src/app/(auth)/login/actions.ts` | `signIn` server action |
| Create | `src/app/(admin)/layout.tsx` | Admin layout — renders Sidebar |
| Create | `src/app/(admin)/actions.ts` | `signOut` server action |
| Move × 18 | `src/app/page.tsx` + 17 admin subdirectory pages | Into `src/app/(admin)/` |
| Modify | `src/components/Sidebar.tsx` | Add logout button |

---

## Task 1: Add Supabase SSR Client Helpers

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Read the current file**

Open `src/lib/supabase.ts` and confirm its current contents (anon client + service role client).

- [ ] **Step 2: Add the two SSR helpers**

Replace the contents of `src/lib/supabase.ts` with:

```ts
import { createClient } from "@supabase/supabase-js";
import { createServerClient as supabaseCreateServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser / client-component client (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role for admin operations
export function createServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  );
}

// For use in server actions, server components, and route handlers.
// cookies() returns a Promise in Next.js 15+, so createSSRClient must be async.
export async function createSSRClient() {
  const cookieStore = await cookies();
  return supabaseCreateServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

// For use in middleware — reads cookies from request, writes to response
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return supabaseCreateServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. If there are import errors, confirm `@supabase/ssr` exports `createServerClient` (check `node_modules/@supabase/ssr/dist/main/index.js`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add createSSRClient and createMiddlewareClient helpers"
```

---

## Task 2: Create Middleware

**Files:**
- Create: `middleware.ts` (project root, same level as `package.json`)

- [ ] **Step 1: Create `middleware.ts` at the project root**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);

  // getUser() contacts Supabase Auth server — do NOT use getSession() here
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") || pathname.startsWith("/forms");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Return response so refreshed session cookies are sent back to the browser
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. If you see "Module not found" for `@/lib/supabase`, check that `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }` — the middleware at the root still uses the `@/` alias.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware with Supabase session check"
```

---

## Task 3: Strip Root Layout and Create Route Group Layouts

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(admin)/layout.tsx`

- [ ] **Step 1: Strip `src/app/layout.tsx` to a bare shell**

Replace the full contents:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TMMT Rentals",
  description: "Vehicle rental management system",
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `src/app/(auth)/layout.tsx`**

Minimal layout — centered container, no sidebar:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(admin)/layout.tsx`**

Admin layout — renders the Sidebar and offsets content:

```tsx
import Sidebar from "@/components/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: succeeds. At this point the admin pages still live at `src/app/` not inside `(admin)/` — they will not have the sidebar yet. That's fine; the next task moves them.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/\(auth\)/layout.tsx src/app/\(admin\)/layout.tsx
git commit -m "feat: create route group layouts for auth and admin"
```

---

## Task 4: Move Admin Pages into (admin) Route Group

This task moves 19 pages (root dashboard + 18 admin) into `src/app/(admin)/`. URLs are unchanged — Next.js route groups are transparent to routing.

**Files:**
- Move: `src/app/page.tsx` → `src/app/(admin)/page.tsx`
- Move: `src/app/appointments/page.tsx` → `src/app/(admin)/appointments/page.tsx`
- Move: `src/app/background-checks/page.tsx` → `src/app/(admin)/background-checks/page.tsx`
- Move: `src/app/contracts/page.tsx` → `src/app/(admin)/contracts/page.tsx`
- Move: `src/app/customers/page.tsx` → `src/app/(admin)/customers/page.tsx`
- Move: `src/app/do-not-rent/page.tsx` → `src/app/(admin)/do-not-rent/page.tsx`
- Move: `src/app/expenses/page.tsx` → `src/app/(admin)/expenses/page.tsx`
- Move: `src/app/fleet/page.tsx` → `src/app/(admin)/fleet/page.tsx`
- Move: `src/app/former-customers/page.tsx` → `src/app/(admin)/former-customers/page.tsx`
- Move: `src/app/inspections/page.tsx` → `src/app/(admin)/inspections/page.tsx`
- Move: `src/app/insurance/page.tsx` → `src/app/(admin)/insurance/page.tsx`
- Move: `src/app/leads/page.tsx` → `src/app/(admin)/leads/page.tsx`
- Move: `src/app/maintenance/page.tsx` → `src/app/(admin)/maintenance/page.tsx`
- Move: `src/app/operation-costs/page.tsx` → `src/app/(admin)/operation-costs/page.tsx`
- Move: `src/app/payments/page.tsx` → `src/app/(admin)/payments/page.tsx`
- Move: `src/app/tickets/page.tsx` → `src/app/(admin)/tickets/page.tsx`
- Move: `src/app/vendors/page.tsx` → `src/app/(admin)/vendors/page.tsx`
- Move: `src/app/waitlist/page.tsx` → `src/app/(admin)/waitlist/page.tsx`

- [ ] **Step 1: Create destination directories and move all pages**

```bash
mkdir -p src/app/\(admin\)/{appointments,background-checks,contracts,customers,do-not-rent,expenses,fleet,former-customers,inspections,insurance,leads,maintenance,operation-costs,payments,tickets,vendors,waitlist}

mv src/app/page.tsx src/app/\(admin\)/page.tsx
mv src/app/appointments/page.tsx src/app/\(admin\)/appointments/page.tsx
mv src/app/background-checks/page.tsx src/app/\(admin\)/background-checks/page.tsx
mv src/app/contracts/page.tsx src/app/\(admin\)/contracts/page.tsx
mv src/app/customers/page.tsx src/app/\(admin\)/customers/page.tsx
mv src/app/do-not-rent/page.tsx src/app/\(admin\)/do-not-rent/page.tsx
mv src/app/expenses/page.tsx src/app/\(admin\)/expenses/page.tsx
mv src/app/fleet/page.tsx src/app/\(admin\)/fleet/page.tsx
mv src/app/former-customers/page.tsx src/app/\(admin\)/former-customers/page.tsx
mv src/app/inspections/page.tsx src/app/\(admin\)/inspections/page.tsx
mv src/app/insurance/page.tsx src/app/\(admin\)/insurance/page.tsx
mv src/app/leads/page.tsx src/app/\(admin\)/leads/page.tsx
mv src/app/maintenance/page.tsx src/app/\(admin\)/maintenance/page.tsx
mv src/app/operation-costs/page.tsx src/app/\(admin\)/operation-costs/page.tsx
mv src/app/payments/page.tsx src/app/\(admin\)/payments/page.tsx
mv src/app/tickets/page.tsx src/app/\(admin\)/tickets/page.tsx
mv src/app/vendors/page.tsx src/app/\(admin\)/vendors/page.tsx
mv src/app/waitlist/page.tsx src/app/\(admin\)/waitlist/page.tsx
```

- [ ] **Step 2: Remove the now-empty source directories**

```bash
rmdir src/app/appointments src/app/background-checks src/app/contracts \
  src/app/customers src/app/do-not-rent src/app/expenses src/app/fleet \
  src/app/former-customers src/app/inspections src/app/insurance src/app/leads \
  src/app/maintenance src/app/operation-costs src/app/payments src/app/tickets \
  src/app/vendors src/app/waitlist
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: 26 pages generated (18 admin + 8 forms), all routes intact. Confirm the output lists `/fleet`, `/leads`, etc. — not `/(admin)/fleet`. If any pages are missing, check the move completed correctly with `ls src/app/\(admin\)/`.

> **Do not test in a browser yet.** The middleware (added in Task 2) will redirect every request to `/login`, but that route does not exist until Task 5. Browser testing between Tasks 2 and 5 will produce a redirect loop. The build check is sufficient here.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: move admin pages into (admin) route group"
```

---

## Task 5: Create Login Page and Server Actions

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`
- Create: `src/app/(admin)/actions.ts`

- [ ] **Step 1: Create the sign-in server action**

Create `src/app/(auth)/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createSSRClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
```

- [ ] **Step 2: Create the sign-out server action**

Create `src/app/(admin)/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase";

export async function signOut() {
  const supabase = await createSSRClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 3: Create the login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TMMT Rentals</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: build succeeds with `/login` now listed as a generated route. Confirm it appears in the route output.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx src/app/\(auth\)/login/actions.ts src/app/\(admin\)/actions.ts
git commit -m "feat: add login page and sign-in/sign-out server actions"
```

---

## Task 6: Add Logout Button to Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add the logout button to the Sidebar**

In `src/components/Sidebar.tsx`:

1. Add `LogOut` to the lucide-react imports:
   ```ts
   import { ..., LogOut } from "lucide-react";
   ```

2. Add the import for the signOut action at the top of the file (after the existing imports):
   ```ts
   import { signOut } from "@/app/(admin)/actions";
   ```

3. Add a logout button at the bottom of the `<aside>`, just before the closing `</aside>` tag (after the `<nav>` block):
   ```tsx
   <div className="p-3 border-t border-gray-200 dark:border-slate-700 mt-auto">
     <form action={signOut}>
       <button
         type="submit"
         className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
       >
         <LogOut size={18} />
         Sign Out
       </button>
     </form>
   </div>
   ```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add logout button to sidebar"
```

---

## Task 7: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify redirect to login when unauthenticated**

Open `http://localhost:3000` in a browser. Expected: immediate redirect to `http://localhost:3000/login`. The login form appears with no sidebar.

- [ ] **Step 3: Verify public forms are accessible**

Navigate to `http://localhost:3000/forms/lead-intake`. Expected: form renders without redirect.

- [ ] **Step 4: Verify login with wrong credentials shows error**

On the login page, enter a bad email/password. Expected: "Invalid login credentials" (or similar) message appears inline below the form. No page reload.

- [ ] **Step 5: Create an admin user in Supabase dashboard**

In the Supabase dashboard → Authentication → Users → Add user:
- Email: your admin email
- Password: a strong password
- Do NOT check "Auto confirm" — confirm immediately

- [ ] **Step 6: Sign in with valid credentials**

Enter the credentials on the login page. Expected: redirect to `/` (dashboard) with the sidebar visible and all KPI stats loading.

- [ ] **Step 7: Verify logout**

Click "Sign Out" in the sidebar. Expected: redirect to `/login`. Navigating back to `/` redirects to `/login` again.

- [ ] **Step 8: Verify all 18 admin routes are accessible after login**

Navigate to `/fleet`, `/leads`, `/tickets`. Expected: all pages load normally with data from Supabase.

- [ ] **Step 9: Final production build check**

```bash
npm run build
```

Expected: clean build, 27 routes (18 admin + 8 forms + 1 login), 0 errors.

- [ ] **Step 10: Commit if any minor fixes were made during verification**

```bash
git add -A
git commit -m "fix: post-auth verification fixes"
```

---

## Notes

- **No test framework is installed** in this project (`jest`, `playwright`, etc. are absent from `package.json`). Manual verification in Task 7 covers the auth flow. Testing infrastructure is a separate future concern.
- **Accounts are created manually** in the Supabase dashboard. There is no signup page.
- **RLS is still disabled.** This is intentional and out of scope — see the spec for the note on public forms.
- **Dark mode** is handled by the theme script in the root layout, which is preserved. The login page inherits dark mode correctly.
