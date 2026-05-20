import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientRentalHub } from "./queries";
import { getClientRentalHub } from "./queries";

export type ClientVehicleHub = ClientRentalHub & {
  bookings: {
    id: string;
    ref_code: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    vehicle: {
      id: string;
      label: string;
      make: string | null;
      model: string | null;
      year: number | null;
      plate: string | null;
    } | null;
  }[];
  payments: {
    id: string;
    amount_cents: number;
    status: string;
    created_at: string;
  }[];
  damages: {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    created_at: string;
    vehicle_label: string | null;
  }[];
  media: {
    id: string;
    caption: string | null;
    file_name: string | null;
    media_type: string;
    created_at: string;
    signed_url: string | null;
  }[];
};

export async function getClientVehicleHub(email: string): Promise<ClientVehicleHub> {
  const supabase = createSupabaseServerClient();
  const normalized = email.trim();
  const base = await getClientRentalHub(normalized);

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
        id, ref_code, status, starts_at, ends_at,
        vehicles:vehicle_id ( id, label, make, model, year, plate )
      `
    )
    .ilike("customer_email", normalized)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(10);

  const bookingIds = (bookings ?? []).map((b) => b.id);

  const [{ data: payments }, { data: damages }, { data: media }] = await Promise.all([
    bookingIds.length > 0
      ? supabase
          .from("payments")
          .select("id, amount_cents, status, created_at")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] as { id: string; amount_cents: number; status: string; created_at: string }[] }),
    supabase
        .from("vehicle_damage_reports")
        .select(
          `
          id, title, description, severity, status, created_at,
          vehicles:vehicle_id ( label )
        `
        )
        .eq("visible_to_client", true)
        .ilike("customer_email", normalized)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("vehicle_media")
        .select("id, caption, file_name, media_type, storage_path, created_at")
        .eq("visible_to_client", true)
        .ilike("customer_email", normalized)
        .order("created_at", { ascending: false })
        .limit(24),
  ]);

  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (m) => {
      const { data: signed } = await supabase.storage
        .from("vehicle-media")
        .createSignedUrl(m.storage_path, 3600);
      return {
        id: m.id,
        caption: m.caption,
        file_name: m.file_name,
        media_type: m.media_type,
        created_at: m.created_at,
        signed_url: signed?.signedUrl ?? null,
      };
    })
  );

  return {
    ...base,
    bookings: (bookings ?? []).map((b) => {
      const raw = b.vehicles as
        | { id: string; label: string; make: string | null; model: string | null; year: number | null; plate: string | null }
        | { id: string; label: string; make: string | null; model: string | null; year: number | null; plate: string | null }[]
        | null;
      const v = Array.isArray(raw) ? raw[0] : raw;
      return {
        id: b.id,
        ref_code: b.ref_code,
        status: b.status,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        vehicle: v
          ? {
              id: v.id,
              label: v.label,
              make: v.make,
              model: v.model,
              year: v.year,
              plate: v.plate,
            }
          : null,
      };
    }),
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      amount_cents: p.amount_cents,
      status: p.status,
      created_at: p.created_at,
    })),
    damages: (damages ?? []).map((d) => {
      const raw = d.vehicles as { label: string } | { label: string }[] | null;
      const v = Array.isArray(raw) ? raw[0] : raw;
      return {
        id: d.id,
        title: d.title,
        description: d.description,
        severity: d.severity,
        status: d.status,
        created_at: d.created_at,
        vehicle_label: v?.label ?? null,
      };
    }),
    media: mediaWithUrls,
  };
}
