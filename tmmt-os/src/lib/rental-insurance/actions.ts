"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkLotRelease } from "./lot-release";
import type { InsuranceCoverageSource } from "@/lib/rental-pricing/types";

export type InsuranceActionResult = { success: boolean; error?: string };

/** Staff verifies insurance and optionally approves lot release for a booking. */
export async function verifyRentalInsurance(input: {
  bookingId: string;
  coverageSource: InsuranceCoverageSource;
  policyNumber?: string;
  carrierName?: string;
  corporatePolicyId?: string;
  weeklyPremiumCents?: number;
  approveLotRelease?: boolean;
}): Promise<InsuranceActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, customer_email, profile_id")
    .eq("id", input.bookingId)
    .single();

  if (bookingErr || !booking) {
    return { success: false, error: "Booking not found" };
  }

  const insuranceVerified = true;
  const lotReleaseApproved = Boolean(input.approveLotRelease);

  const gate = checkLotRelease({
    coverageSource: input.coverageSource,
    insuranceVerified,
    lotReleaseApproved,
    corporatePolicyId: input.corporatePolicyId,
    policyNumber: input.policyNumber,
    carrierName: input.carrierName,
  });

  if (input.approveLotRelease && !gate.approved) {
    return { success: false, error: gate.blockers.join(" ") };
  }

  const { error: selErr } = await supabase.from("rental_insurance_selections").upsert(
    {
      booking_id: booking.id,
      profile_id: booking.profile_id,
      customer_email: booking.customer_email,
      coverage_source: input.coverageSource,
      policy_number: input.policyNumber ?? null,
      carrier_name: input.carrierName ?? null,
      corporate_policy_id: input.corporatePolicyId ?? null,
      weekly_premium_cents: input.weeklyPremiumCents ?? 0,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      lot_release_approved: lotReleaseApproved,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "booking_id" }
  );

  if (selErr) {
    return { success: false, error: selErr.message };
  }

  const { error: bookErr } = await supabase
    .from("bookings")
    .update({
      insurance_coverage_source: input.coverageSource,
      insurance_verified: insuranceVerified,
      lot_release_approved: lotReleaseApproved,
    })
    .eq("id", input.bookingId);

  if (bookErr) {
    return { success: false, error: bookErr.message };
  }

  if (input.weeklyPremiumCents && input.weeklyPremiumCents > 0) {
    await supabase.from("rental_ledger").insert({
      booking_id: booking.id,
      customer_email: booking.customer_email,
      profile_id: booking.profile_id,
      entry_type: "insurance_premium",
      status: "pending",
      title: "Rental insurance premium",
      amount_cents: input.weeklyPremiumCents,
      visible_to_client: true,
      metadata: { coverage_source: input.coverageSource },
    });
  }

  revalidatePath("/client/rental");
  revalidatePath("/internal/journey");
  return { success: true };
}
