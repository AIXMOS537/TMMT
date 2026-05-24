# Supabase Auth — Design Spec
**Date:** 2026-03-24
**Status:** Approved

---

## Overview

Add email + password authentication to TMMT Rentals using Supabase Auth and `@supabase/ssr`. All admin routes are protected behind a session check in Next.js middleware. Public intake forms remain fully accessible. All-or-nothing access — any authenticated user can do everything.

---

## Requirements

- Email + password login only (no magic link, no OAuth)
- All routes protected except `/login` and `/forms/*`
- Redirect unauthenticated requests to `/login`
- Redirect authenticated users to `/` (dashboard) after login
- Logout available from the sidebar
- Admin accounts created manually in Supabase dashboard (no public signup)
- Single permission level — no roles

---

## Architecture

### Auth Strategy: Middleware-only

Next.js `middleware.ts` at the **project root** (not `src/`) intercepts every request and checks the Supabase session using `supabase.auth.getUser()` — not `getSession()`. `getUser()` contacts the Supabase Auth server to verify the token; `getSession()` reads only from cookies and must not be used for authorization decisions.

`@supabase/ssr` (already installed) handles cookie-based session management and automatic token refresh.

### Route Groups

To prevent the `<Sidebar />` from rendering on the login page, the app is reorganized into two route groups:

- `src/app/(admin)/` — all current admin pages + root dashboard; wrapped in a layout that includes `<Sidebar />`
- `src/app/(auth)/login/` — login page with a minimal centered layout (no sidebar)

The root `src/app/layout.tsx` becomes a bare shell (html/body/theme script only, no Sidebar).

### Public Routes (no auth check)
- `/login`
- `/forms/*`

### Protected Routes (all others, inside `(admin)` group)
- `/` (dashboard)
- All 18 admin pages

---

## Files

### New Files

| File | Purpose |
|---|---|
| `middleware.ts` (project root) | Session check via `getUser()` on every request; redirect to `/login` if unauthenticated; matcher excludes static assets |
| `src/app/(auth)/login/page.tsx` | Email + password login form (client component) |
| `src/app/(auth)/login/actions.ts` | Server action: `signInWithPassword()` → redirect to `/` on success |
| `src/app/(auth)/layout.tsx` | Minimal layout for auth pages — no Sidebar |
| `src/app/(admin)/layout.tsx` | Admin layout — renders `<Sidebar />` |
| `src/app/(admin)/actions.ts` | Server action: `signOut()` → redirect to `/login` |

### Modified Files

| File | Change |
|---|---|
| `src/app/layout.tsx` | Stripped to bare shell: html, body, theme script only. No Sidebar. |
| `src/lib/supabase.ts` | Add two SSR helpers: `createSSRClient()` for server actions, `createMiddlewareClient(req, res)` for middleware. Both use `@supabase/ssr`'s `createServerClient` internally. Existing anon client and service role client unchanged. |
| `src/components/Sidebar.tsx` | Add logout button that calls `signOut()` server action from `src/app/(admin)/actions.ts` → redirect to `/login` |

### Files to Move (route group reorganization)

All current pages under `src/app/` (except `/forms/*`) move into `src/app/(admin)/`. For example:
- `src/app/page.tsx` → `src/app/(admin)/page.tsx`
- `src/app/fleet/page.tsx` → `src/app/(admin)/fleet/page.tsx`
- etc.

URLs are unaffected by route groups — `/fleet` still routes to `/fleet`.

---

## Supabase Client Helpers

Two distinct helpers added to `src/lib/supabase.ts` to avoid naming collision with `@supabase/ssr`'s own `createServerClient` export:

```ts
// For use in server actions, server components, and route handlers
// cookies() returns a Promise in Next.js 15+, so this function must be async
export async function createSSRClient() {
  const cookieStore = await cookies() // next/headers
  return supabaseSSR.createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  })
}

// For use in middleware (reads from request, writes to response)
export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return supabaseSSR.createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })
}
```

---

## Middleware

```ts
// middleware.ts (project root)
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createMiddlewareClient(request, response)

  // getUser() contacts Supabase Auth server to verify the token
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/forms')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Return response so updated session cookies are propagated to the browser
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
```

---

## Auth Flow

### Login
1. User visits any protected route
2. Middleware calls `getUser()` — no session → redirect to `/login`
3. User submits email + password
4. Server action calls `supabase.auth.signInWithPassword()`
5. On success → redirect to `/`
6. On failure → return error message to form

### Session Refresh
- Middleware propagates refreshed cookies back to the browser on every request via `createMiddlewareClient`

### Logout
1. User clicks logout in sidebar
2. Server action calls `supabase.auth.signOut()`
3. Redirect to `/login`

---

## Login Page Design

- Minimal centered form, no sidebar
- Fields: Email, Password
- Button: "Sign In"
- Inline error message below form on failure
- No signup link (accounts created manually in Supabase dashboard)
- Respects existing dark mode styling

---

## Out of Scope

- Row-Level Security (RLS) — separate future task
  - **Note:** Public forms currently rely on RLS being disabled for anonymous inserts. Enabling RLS in the future must include explicit anon INSERT policies for form tables (`incoming_leads`, `background_checks`, `waitlist`, `appointments`, `tickets`, `customer_inspection_photos`, `vehicle_handovers`).
- Role-based access control
- Password reset / forgot password flow
- OAuth / magic link
- User management UI
- Session activity logging
