import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Is an integration quiet because nothing happened, or because it is broken?
 *
 * WHY THIS EXISTS. The GHL inbound rail has received **zero** webhooks since it was built,
 * and `crm_sync_records` stopped on 2026-06-03. Neither was noticed for months, because
 * nothing anywhere reports an integration that is simply silent. Every existing check asks
 * "did this call fail?" — none asks "has this called at all lately?" A rail that stops is
 * indistinguishable from a quiet week until someone goes looking.
 *
 * THE DISTINCTION THAT MATTERS. "Never fired" and "stopped firing" are different faults
 * with different fixes:
 *
 *   never    — it was never wired up. Nobody pointed the other system at us. No amount of
 *              debugging our code finds this, because our code is fine.
 *   stale    — it worked and then stopped. Something broke, or a credential expired.
 *   fresh    — seen inside its expected window.
 *
 * Reporting both as "unhealthy" would send someone hunting a bug in working code. So they
 * are reported separately and say which they are.
 */

export type FreshnessState = "fresh" | "stale" | "never";

export type IntegrationFreshness = {
  name: string;
  state: FreshnessState;
  /** ISO timestamp of the most recent activity, or null when there has never been any. */
  lastSeen: string | null;
  ageHours: number | null;
  /** Hours after which this rail is considered stale. */
  thresholdHours: number;
  /** Plain English, aimed at whoever is on call rather than whoever wrote it. */
  detail: string;
};

type Probe = {
  name: string;
  table: string;
  column: string;
  thresholdHours: number;
  neverDetail: string;
  staleDetail: string;
};

/**
 * Thresholds are generous on purpose. This is meant to catch "dead for a month", not to
 * page anyone about a quiet afternoon — a noisy check gets muted, and a muted check is
 * exactly the failure this is trying to fix.
 */
export const GHL_PROBES: Probe[] = [
  {
    name: "ghl-inbound-webhooks",
    table: "ghl_webhook_events",
    column: "seen_at",
    thresholdHours: 168, // one week
    neverDetail:
      "No GHL webhook has ever been received. The endpoints are live and the secret is set, " +
      "so this means GHL has not been pointed at them — a console task, not a code fix. " +
      "See docs/GHL-WEBHOOK-SETUP.md.",
    staleDetail: "GHL webhooks have stopped arriving. Check the workflow and the shared secret.",
  },
  {
    name: "ghl-contact-sync",
    table: "ghl_contacts",
    column: "updated_at",
    thresholdHours: 336, // two weeks; the pull is weekly
    neverDetail: "No GHL contact has ever synced. Check GHL_API_KEY and the location id.",
    staleDetail: "The GHL contact pull has not run recently. Check the weekly cron and the API key.",
  },
  {
    name: "crm-sync-records",
    table: "crm_sync_records",
    column: "updated_at",
    thresholdHours: 336,
    neverDetail: "The CRM sync rail has never written a record.",
    staleDetail:
      "The CRM sync rail has stopped writing. Decide whether it is still wanted before " +
      "repairing it — a dead rail nobody misses should be retired, not fixed.",
  },
];

async function probeOne(
  db: SupabaseClient,
  p: Probe,
  now: number,
): Promise<IntegrationFreshness> {
  const { data, error } = await db
    .from(p.table)
    .select(p.column)
    .order(p.column, { ascending: false })
    .limit(1);

  if (error) {
    // An unreadable source is NOT a quiet one. Saying "fresh" here would be the exact
    // silent-green this file exists to prevent.
    return {
      name: p.name,
      state: "stale",
      lastSeen: null,
      ageHours: null,
      thresholdHours: p.thresholdHours,
      detail: `Could not read ${p.table}: ${error.message}`,
    };
  }

  const row = ((data ?? []) as unknown[])[0] as Record<string, string> | undefined;
  const raw = row?.[p.column];

  if (!raw) {
    return {
      name: p.name,
      state: "never",
      lastSeen: null,
      ageHours: null,
      thresholdHours: p.thresholdHours,
      detail: p.neverDetail,
    };
  }

  const ms = now - new Date(raw).getTime();
  const ageHours = Math.max(0, Math.round(ms / 3_600_000));
  const stale = ageHours > p.thresholdHours;

  return {
    name: p.name,
    state: stale ? "stale" : "fresh",
    lastSeen: raw,
    ageHours,
    thresholdHours: p.thresholdHours,
    detail: stale
      ? `${p.staleDetail} Last activity ${ageHours}h ago.`
      : `Last activity ${ageHours}h ago.`,
  };
}

/** Every probe, always — a caller that only wants problems can filter. */
export async function checkIntegrationFreshness(
  db: SupabaseClient,
  probes: Probe[] = GHL_PROBES,
  now: number = Date.now(),
): Promise<IntegrationFreshness[]> {
  return Promise.all(probes.map(p => probeOne(db, p, now)));
}

/** Just the ones needing attention. `never` is included — it is the loudest case here. */
export function problemsOnly(all: IntegrationFreshness[]): IntegrationFreshness[] {
  return all.filter(f => f.state !== "fresh");
}
