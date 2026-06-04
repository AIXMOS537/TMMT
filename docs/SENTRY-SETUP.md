# Sentry Error Monitoring — Setup Guide

## What is Sentry?

Sentry is a **real-time error monitoring service** that catches crashes and failures in your app before users report them.

**What it does for TMMT:**
- Catches JavaScript errors on any page (broken forms, failed saves, UI crashes)
- Catches server-side errors (failed database writes, auth failures, server action errors)
- Sends you an alert (email or Slack) with the exact error, stack trace, browser, and page URL
- Records Session Replay on errors — see exactly what the user did before the crash
- Tracks performance (slow page loads, slow API calls)

**Without Sentry:** Errors happen silently. You only find out when someone complains.
**With Sentry:** You get notified immediately with everything you need to fix it.

---

## Current Status

The Sentry SDK (`@sentry/nextjs`) is **installed and configured** but **inactive**. It activates once you set the DSN environment variable.

### What's already wired up

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Browser-side error capture + session replay on errors |
| `sentry.server.config.ts` | Server-side error capture (server actions, API routes) |
| `sentry.edge.config.ts` | Edge runtime capture (middleware errors) |
| `src/app/global-error.tsx` | Root error boundary — reports to Sentry, shows recovery UI |
| `next.config.ts` | Wrapped with `withSentryConfig()` for source maps + instrumentation |

### Current configuration

| Setting | Value | What it means |
|---------|-------|---------------|
| `enabled` | `NODE_ENV === "production"` | Only active in production builds, not during `npm run dev` |
| `tracesSampleRate` | `0.1` (10%) | 10% of page loads send performance data — keeps costs low |
| `replaysSessionSampleRate` | `0` | No session replays by default (saves quota) |
| `replaysOnErrorSampleRate` | `1.0` (100%) | When an error happens, always record a session replay |

---

## Activation Steps

### 1. Create a Sentry account (free)

1. Go to [sentry.io](https://sentry.io) and sign up
2. Free tier includes **5,000 errors/month** and **1 GB of session replays** — more than enough for TMMT

### 2. Create a project

1. Click **"Create Project"** in the Sentry dashboard
2. Select **Next.js** as the platform
3. Name it `tmmt-rentals` (or whatever you prefer)
4. Click **Create**

### 3. Copy the DSN

After creating the project, Sentry shows you a DSN. It looks like:

```
https://abc123def456@o789.ingest.us.sentry.io/1234567
```

### 4. Add DSN to your environment

Open `.env` in the project root and set:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-actual-dsn-here@o123.ingest.us.sentry.io/456
```

### 5. Deploy or restart production

Sentry only activates when `NODE_ENV=production`. Either:
- Deploy to your hosting provider (Vercel, etc.), or
- Test locally with: `npm run build && npm run start`

### 6. Verify it works

1. Open your production app in a browser
2. Open the browser console and run: `throw new Error("Sentry test")`
3. Check the Sentry dashboard — the error should appear within 30 seconds

---

## Optional: Set up alerts

By default, Sentry sends email alerts. You can also connect:

- **Slack** — get errors in a channel (Settings > Integrations > Slack)
- **Custom rules** — only alert on specific errors or error rates (Alerts > Create Rule)

### Recommended alert rules for TMMT

| Rule | Trigger | Why |
|------|---------|-----|
| New issue | First occurrence of any new error | Catch new bugs immediately |
| High frequency | Same error 10+ times in 1 hour | Something is broken for multiple users |
| Server action failure | Errors containing `upsert failed` | Database write failures need fast response |

---

## How it integrates with TMMT

### Error boundaries

`src/app/global-error.tsx` catches unhandled errors at the root level and reports them to Sentry:

```tsx
useEffect(() => {
  Sentry.captureException(error);
}, [error]);
```

The user sees a friendly "Something went wrong" page with a retry button. You see the full stack trace in Sentry.

### Server actions

When `adminUpsert()` or any form action fails, the error is logged server-side with `console.error()`. With Sentry active, unhandled exceptions in server actions are automatically captured.

### CSP headers

The Content-Security-Policy in `next.config.ts` already allows connections to `https://*.sentry.io` — no CSP changes needed.

---

## Adjusting configuration

### Increase performance sampling

If you want more performance data (at the cost of quota):

```typescript
// sentry.client.config.ts
Sentry.init({
  tracesSampleRate: 0.5, // 50% of page loads
});
```

### Enable session replays for all sessions

```typescript
// sentry.client.config.ts
Sentry.init({
  replaysSessionSampleRate: 0.1, // 10% of all sessions, not just errors
});
```

### Filter out noisy errors

```typescript
// sentry.client.config.ts
Sentry.init({
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
  ],
});
```

---

## Cost

| Plan | Errors/month | Performance events | Session replays | Price |
|------|-------------|-------------------|-----------------|-------|
| **Developer (free)** | 5,000 | 10,000 | 50 | $0 |
| Team | 50,000 | 100,000 | 500 | $26/mo |
| Business | 100,000+ | Custom | Custom | $80+/mo |

For TMMT's current scale, the **free tier** is sufficient.
