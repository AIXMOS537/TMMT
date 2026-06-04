import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { executeRouting } from "@/lib/routing/execute";
import { notifyCaseStatusChange } from "@/lib/ghl/notify";
import { protocolForWorkType } from "./protocols";
import { deliverJobToPartnerApps } from "./deliver-to-apps";
import type { DispatchJobResult, ProtocolStepResult, StaffDispatchJobInput } from "./types";
import type { WorkType } from "@/lib/routing/types";

async function recordProtocolStep(
  runId: string,
  step: ProtocolStepResult
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: row } = await supabase
    .from("protocol_runs")
    .select("steps")
    .eq("id", runId)
    .maybeSingle();

  const steps = [...((row?.steps as ProtocolStepResult[]) ?? []), step];
  await supabase
    .from("protocol_runs")
    .update({
      steps,
      status: step.ok ? "running" : "failed",
      error: step.ok ? null : step.detail ?? "step failed",
    })
    .eq("id", runId);
}

/**
 * Staff dispatch intake: local vendor outsources work → case → full protocol chain → partner apps.
 */
export async function createStaffDispatchJob(
  input: StaffDispatchJobInput
): Promise<DispatchJobResult> {
  const supabase = createSupabaseServiceClient();
  const workType = input.work_type as WorkType;
  const protocol = protocolForWorkType(workType);
  const requestType = input.request_type ?? "delivery";
  const businessLine = input.business_line ?? "dispatch";

  const intakePayload = {
    source: "staff_dispatch",
    vendor_company: input.vendor_company,
    vendor_contact_name: input.vendor_contact_name,
    vendor_contact_email: input.vendor_contact_email,
    vendor_contact_phone: input.vendor_contact_phone,
    pickup: input.pickup,
    dropoff: input.dropoff,
    window_start: input.window_start,
    window_end: input.window_end,
    work_type: workType,
  };

  const { data: intake, error: intakeErr } = await supabase
    .from("customer_intake_forms")
    .insert({
      customer_name: input.vendor_company,
      customer_email: input.vendor_contact_email ?? null,
      customer_phone: input.vendor_contact_phone ?? null,
      request_type: requestType,
      subject: input.subject,
      details: input.details ?? null,
      source: "staff_dispatch",
      payload: intakePayload,
    })
    .select("id")
    .single();

  if (intakeErr || !intake) {
    throw new Error(intakeErr?.message ?? "intake insert failed");
  }

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .insert({
      intake_id: intake.id,
      customer_name: input.vendor_company,
      customer_email: input.vendor_contact_email ?? null,
      customer_phone: input.vendor_contact_phone ?? null,
      request_type: requestType,
      subject: input.subject,
      description: input.details ?? null,
      status: "internal_review",
      business_line: businessLine,
      work_type: workType,
      case_type: protocol.caseType,
      metadata: {
        dispatch: {
          vendor_company: input.vendor_company,
          vendor_contact_name: input.vendor_contact_name,
          outsourced_to_tmmt: true,
        },
      },
    })
    .select("id, ref_code, status")
    .single();

  if (caseErr || !caseRow) {
    throw new Error(caseErr?.message ?? "case insert failed");
  }

  const { data: protocolRun, error: runErr } = await supabase
    .from("protocol_runs")
    .insert({
      case_id: caseRow.id,
      protocol_id: protocol.id,
      status: "running",
      started_at: new Date().toISOString(),
      steps: [],
    })
    .select("id")
    .single();

  if (runErr || !protocolRun) {
    throw new Error(runErr?.message ?? "protocol run insert failed");
  }

  const runId = protocolRun.id;

  await recordProtocolStep(runId, {
    step: "intake_created",
    ok: true,
    data: { intake_id: intake.id, ref_code: caseRow.ref_code },
  });

  await supabase.from("sync_events").insert({
    source: "staff_dispatch",
    event_type: "dispatch.job.created",
    external_id: caseRow.id,
    payload: {
      case_id: caseRow.id,
      ref_code: caseRow.ref_code,
      work_type: workType,
      vendor_company: input.vendor_company,
    },
    processed: true,
  });

  await supabase.from("activity_logs").insert({
    actor_id: input.actor_id ?? null,
    entity: "case",
    entity_id: caseRow.id,
    action: "dispatch_job_created",
    data: {
      protocol_id: protocol.id,
      work_type: workType,
      vendor_company: input.vendor_company,
    },
  });

  let routingResult: Awaited<ReturnType<typeof executeRouting>> | undefined;
  try {
    routingResult = await executeRouting({
      source: "staff_dispatch",
      tags: [workType, "dispatch", businessLine],
      businessLine,
      caseId: caseRow.id,
      customerName: input.vendor_company,
      subject: input.subject,
      customFields: {
        pickup: input.pickup,
        dropoff: input.dropoff,
        pickup_address: input.pickup,
        dropoff_address: input.dropoff,
        window_start: input.window_start,
        window_end: input.window_end,
        vendor_company: input.vendor_company,
      },
    });
    await recordProtocolStep(runId, {
      step: "routing",
      ok: routingResult.errors.length === 0,
      detail: routingResult.errors.join("; ") || undefined,
      data: {
        routing_status: routingResult.routingStatus,
        dispatch_load_id: routingResult.dispatchLoadId,
        clickup_task_id: routingResult.clickupTaskId,
      },
    });

    if (routingResult.dispatchLoadId) {
      await recordProtocolStep(runId, {
        step: "dispatch_load",
        ok: true,
        data: { dispatch_load_id: routingResult.dispatchLoadId },
      });
    }

    if (routingResult.routingStatus === "agent_drafted" || routingResult.routingStatus === "completed") {
      await recordProtocolStep(runId, { step: "agent_draft", ok: true });
    }
  } catch (e) {
    await recordProtocolStep(runId, {
      step: "routing",
      ok: false,
      detail: e instanceof Error ? e.message : "routing failed",
    });
  }

  try {
    void notifyCaseStatusChange({
      caseId: caseRow.id,
      to: "internal_review",
      note: `Dispatch job from ${input.vendor_company}`,
    });
    await recordProtocolStep(runId, { step: "ghl_notify", ok: true });
  } catch (e) {
    await recordProtocolStep(runId, {
      step: "ghl_notify",
      ok: false,
      detail: e instanceof Error ? e.message : "ghl notify failed",
    });
  }

  let vendorJobId: string | undefined;
  if (input.assign_vendor_id) {
    try {
      const { data: job, error: jobErr } = await supabase
        .from("vendor_jobs")
        .insert({
          case_id: caseRow.id,
          vendor_id: input.assign_vendor_id,
          title: input.subject,
          description: input.details ?? null,
          location: input.pickup ?? null,
          offered_price: input.offered_price ?? null,
          due_at: input.due_at ?? null,
          status: "offered",
        })
        .select("id")
        .single();

      if (jobErr) throw new Error(jobErr.message);
      vendorJobId = job.id;

      await supabase.from("cases").update({ status: "vendor_assigned" }).eq("id", caseRow.id);
      await recordProtocolStep(runId, {
        step: "vendor_assignment",
        ok: true,
        data: { vendor_job_id: vendorJobId },
      });
    } catch (e) {
      await recordProtocolStep(runId, {
        step: "vendor_assignment",
        ok: false,
        detail: e instanceof Error ? e.message : "vendor assignment failed",
      });
    }
  } else {
    await recordProtocolStep(runId, {
      step: "vendor_assignment",
      ok: true,
      detail: "skipped — no TMMT vendor assigned yet",
    });
  }

  const deliveries = await deliverJobToPartnerApps({
    caseId: caseRow.id,
    refCode: caseRow.ref_code,
    vendorJobId,
    workType,
    caseType: protocol.caseType,
    subject: input.subject,
    targetPartnerApps: input.target_partner_apps,
    payload: {
      vendor: {
        company: input.vendor_company,
        contact_name: input.vendor_contact_name,
        contact_email: input.vendor_contact_email,
        contact_phone: input.vendor_contact_phone,
      },
      route: {
        pickup: input.pickup,
        dropoff: input.dropoff,
        window_start: input.window_start,
        window_end: input.window_end,
      },
      pricing: {
        offered_price: input.offered_price,
        due_at: input.due_at,
      },
      details: input.details,
      protocol_id: protocol.id,
    },
  });

  await recordProtocolStep(runId, {
    step: "partner_app_delivery",
    ok: deliveries.every((d) => d.status === "delivered") || deliveries.length === 0,
    detail:
      deliveries.length === 0
        ? "no partner endpoints configured"
        : deliveries.map((d) => `${d.partner_app_slug}:${d.status}`).join(", "),
    data: { deliveries },
  });

  const allOk = deliveries.every((d) => d.status === "delivered" || d.status === "pending");
  await supabase
    .from("protocol_runs")
    .update({
      status: allOk ? "completed" : "failed",
      vendor_job_id: vendorJobId ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  return {
    caseId: caseRow.id,
    refCode: caseRow.ref_code,
    vendorJobId,
    protocolRunId: runId,
    workType,
    caseType: protocol.caseType,
    deliveries: deliveries.map((d) => ({
      partner_app_slug: d.partner_app_slug,
      status: d.status,
      delivery_id: d.delivery_id,
    })),
    routing: routingResult
      ? {
          routing_status: routingResult.routingStatus,
          dispatch_load_id: routingResult.dispatchLoadId,
          clickup_task_id: routingResult.clickupTaskId,
          errors: routingResult.errors,
        }
      : undefined,
  };
}
