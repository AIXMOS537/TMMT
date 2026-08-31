import * as Sentry from "@sentry/nextjs";

/**
 * Loads Sentry on the server and the edge.
 *
 * Without this file, sentry.server.config.ts and sentry.edge.config.ts are
 * never imported — Next only reaches them through register() — so Sentry.init
 * never ran anywhere except the browser. The configs existed, the DSN could be
 * set, the build looked clean, and every server-side exception in the app went
 * nowhere. The production build says so out loud: "Could not find a Next.js
 * instrumentation file... required for the Sentry SDK to be initialized on the
 * server."
 *
 * onRequestError is what reports errors thrown inside server components, route
 * handlers and server actions. It is a separate hook from register(), and
 * without it those three — most of this app — stay silent even once init runs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
