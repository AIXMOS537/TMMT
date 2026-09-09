import "server-only";
import { clearDegraded, reportDegraded } from "@/lib/degraded";
import { resolveVentureDb } from "./client";

export type VentureStatus = "active" | "paused" | "archived";

export interface Venture {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  logo_url: string | null;
  status: VentureStatus;
  pinned_widgets: unknown;
}

/**
 * The registry of businesses running under one roof — rentals, detailing,
 * chauffeur, whatever the dealership adds next. Every `/v/[venture]/*` screen
 * resolves through here.
 *
 * The version this replaces returned a hard-coded single "TMMT Rentals" object
 * whenever the database was unreachable, so a broken connection and a
 * one-venture business looked identical on screen — and it had been returning
 * that placeholder in production the whole time, because it was pointed at a
 * Supabase project that does not exist. An empty list and a failed read are
 * different facts, and this module keeps them different: a failure reports
 * through `degraded.ts` and returns nothing, rather than inventing a venture.
 */
const SELECT = "id,slug,name,description,color,logo_url,status,pinned_widgets";

export async function getActiveVentures(): Promise<Venture[]> {
  const db = resolveVentureDb();
  if (!db) {
    reportDegraded("venture-registry", "no Supabase client available for venture data");
    return [];
  }
  const { data, error } = await db
    .from("ventures")
    .select(SELECT)
    .eq("status", "active")
    .order("name");

  if (error) {
    reportDegraded("venture-registry", `ventures query failed: ${error.message}`);
    return [];
  }
  clearDegraded("venture-registry");
  return (data ?? []) as Venture[];
}

export async function getVentureBySlug(slug: string): Promise<Venture | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const db = resolveVentureDb();
  if (!db) {
    reportDegraded("venture-registry", "no Supabase client available for venture data");
    return null;
  }
  const { data, error } = await db
    .from("ventures")
    .select(SELECT)
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) {
    reportDegraded("venture-registry", `venture lookup failed: ${error.message}`, { slug: trimmed });
    return null;
  }
  clearDegraded("venture-registry");
  // No row is not a failure — it is a 404, and the caller renders one.
  return (data as Venture | null) ?? null;
}
