"use server";

import { createSSRClient } from "@/lib/supabase-server";

export type ClockEntry = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
};

export type ClockStatus = {
  open: ClockEntry | null;
  today: ClockEntry[];
  todayMinutes: number;
};

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

/** Current employee's clock state: open shift + today's entries + minutes worked today. */
export async function getClockStatus(): Promise<ClockStatus> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { open: null, today: [], todayMinutes: 0 };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("time_clock_entries")
    .select("id, clock_in, clock_out, note")
    .eq("user_id", user.id)
    .gte("clock_in", startOfDay.toISOString())
    .order("clock_in", { ascending: false });

  const rows = (data ?? []) as ClockEntry[];
  const open = rows.find((r) => !r.clock_out) ?? null;
  const now = new Date().toISOString();
  const todayMinutes = rows.reduce((m, r) => m + minutesBetween(r.clock_in, r.clock_out ?? now), 0);

  return { open, today: rows, todayMinutes };
}

/** Start a shift. No-op (returns the open one) if already clocked in. */
export async function clockIn(note?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("time_clock_entries")
    .select("id")
    .eq("user_id", user.id)
    .is("clock_out", null)
    .limit(1);
  if (existing && existing.length > 0) return { success: true }; // already in

  const { error } = await supabase.from("time_clock_entries").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    clock_in: new Date().toISOString(),
    note: note || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** End the current open shift. */
export async function clockOut(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: open } = await supabase
    .from("time_clock_entries")
    .select("id")
    .eq("user_id", user.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);
  if (!open || open.length === 0) return { success: false, error: "You're not clocked in." };

  const { error } = await supabase
    .from("time_clock_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", open[0].id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
