# TMMT-SEC-001

## TASK ID
TMMT-SEC-001

## TITLE
Close the open redirect in the auth callback (`?next=/%5Cevil.com`)

## PM MILESTONE
PM-00 Security containment (roadmap item 00-i)

## OBJECTIVE
`GET /api/auth/callback` must only ever redirect to a same-origin path. A crafted `next` must never send a user to another host.

## WHY (evidence refs)
- SPEC §20.3 **SEC-09**, §28 **KD-14**, ROADMAP PM-00 00-i.
- E5 §C.1: the guard only rejects a leading `//`. `new URL("/\\evil.com", origin)` → `https://evil.com/`, and `?next=/%5Cevil.com` decodes into that form. A phishing link on a real TMMT domain would land a freshly signed-in user on an attacker's site.

## CURRENT BEHAVIOR (file:line)
- `src/app/api/auth/callback/route.ts:15`: `next = searchParams.get("next") || "/login/reset"`.
- `src/app/api/auth/callback/route.ts:18`: `safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/login/reset"`. A backslash after the first slash, control characters and encoded forms are not handled.
- `src/app/api/auth/callback/route.ts:32`: `NextResponse.redirect(new URL(safeNext, origin))`.
- The route is public (middleware `isPublicPath` includes `/api/auth/`, `src/middleware.ts:47-69`). There are 0 tests for `src/app/(auth)` and no test for this route (E1 §5.2).

## EXPECTED BEHAVIOR
- `next` is accepted only if, after resolution against `origin`, the resulting URL has **the same origin** and a path starting with `/`. Otherwise fall back to `/login/reset`.
- Reject values containing `\`, ASCII control characters or whitespace, and scheme-relative forms (`//`, `/\`, `\/`, `\\`), including their percent-decoded forms.
- The `code` exchange, the error paths (`invalid_link`, `expired_link`) and the default target are unchanged.

## FILES (in scope)
- `src/app/api/auth/callback/route.ts`
- NEW `src/app/api/auth/callback/route.test.ts`
- Optional NEW helper `src/lib/safe-redirect.ts` (+ test) if it is reused. Keep it pure, with no I/O.

## DATABASE ENTITIES
None.

## DEPENDENCIES
None. This can run first.

## CONSTRAINTS
- Do not change middleware or other auth pages.
- Mock `createSSRClient` / `exchangeCodeForSession` in the test. Never call Supabase.
- Keep the response codes (redirects) as they are.

## SECURITY REQUIREMENTS
- Same-origin check by URL parsing (compare `new URL(candidate, origin).origin === origin`), not by string prefix alone.
- Fail closed to `/login/reset` on any parse error.
- Do not log the raw `next` value (it may carry tokens); log a fixed message at most.

## IMPLEMENTATION NOTES
- Next's `req.nextUrl.searchParams.get` already percent-decodes once. Test both the raw and the double-encoded input.
- Suggested helper: `safeRelativePath(input: string | null, origin: string, fallback: string): string`.

## ACCEPTANCE CRITERIA (testable)
1. `next=/%5Cevil.com` → redirect `Location` host equals the request host, path `/login/reset`.
2. `next=//evil.com`, `/\evil.com`, `\\evil.com`, `https://evil.com`, `/%09/evil.com`, `javascript:alert(1)` → all fall back to `/login/reset` on the same origin.
3. `next=/login/reset`, `next=/desk?x=1` → redirect to that same-origin path, query preserved.
4. No `code` → `/login?error=invalid_link` (unchanged). Exchange error → `/login?error=expired_link` (unchanged).
5. The full gate passes.

## TESTS (names/types; must fail on the pre-fix code)
- `route.test.ts` (vitest, node): `rejects backslash host smuggling (/%5Cevil.com)` — **fails on pre-fix code**.
- `rejects scheme-relative and absolute URLs` (table-driven: `//`, `/\`, `\\`, `https://`, `javascript:`, control chars).
- `keeps same-origin relative paths with query`.
- `missing code → invalid_link` and `exchange error → expired_link` (regression).
- If a helper is added: `safe-redirect.test.ts` covering the same table.

## DO NOT CHANGE
- `src/middleware.ts` and `isPublicPath`.
- `src/app/(auth)/login/actions.ts` (the signup path is owned by Phase 2A A4a/A4b).
- The PKCE exchange logic.

## OWNER GATE
None for the code. Merge to master = prod deploy: the owner merges with the prod baton.
