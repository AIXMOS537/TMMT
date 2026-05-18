import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClickUpTask } from "@/lib/clickup/create-task";
import { applyVerifiedSync } from "@/lib/crm-sync/apply-verified";
import type { OpsCommand, OpsCommandResponse, OpsCommandResult } from "./types";
import { parseOpsMessage } from "./parse-message";
import { resolveCase, resolveProfileByEmail, resolveVendorByName } from "./resolve";

async function opsSummary(supabase: SupabaseClient): Promise<OpsCommandResult> {
  const [{ count: pendingSync }, { count: blocked }, { count: open }] = await Promise.all([
    supabase
      .from("crm_sync_records")
      .select("id", { count: "exact", head: true })
      .in("sync_status", ["pending_airtable", "pending_verification"]),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("status", "blocked"),
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(completed,closed)"),
  ]);

  return {
    action: "summary",
    ok: true,
    message: `Pending CRM: ${pendingSync ?? 0} · Blocked cases: ${blocked ?? 0} · Open cases: ${open ?? 0}`,
    links: [
      { label: "CRM queue", href: "/internal/sync" },
      { label: "Blocked cases", href: "/internal/cases?view=list&status=blocked" },
      { label: "Dashboard", href: "/internal/dashboard" },
    ],
    data: { pendingSync, blocked, open },
  };
}

async function runOne(
  supabase: SupabaseClient,
  cmd: OpsCommand,
  actor?: { id: string; email?: string | null }
): Promise<OpsCommandResult> {
  try {
    switch (cmd.action) {
      case "summary":
        return opsSummary(supabase);

      case "assign_staff": {
        const caseRow = await resolveCase(supabase, {
          case_id: cmd.case_id,
          case_ref: cmd.case_ref,
          customer_email: cmd.customer_email,
        });
        if (!caseRow) {
          return { action: cmd.action, ok: false, message: "Case not found. Use case ref (e.g. TMMT-ABC123)." };
        }

        const assignee = await resolveProfileByEmail(supabase, cmd.assignee_email);
        const listId = process.env.CLICKUP_DEFAULT_LIST_ID;
        let clickupUrl: string | undefined;
        let clickupId: string | undefined;

        if (listId) {
          const created = await createClickUpTask({
            listId,
            name: cmd.title ?? `${caseRow.ref_code}: ${caseRow.subject}`,
            description: [
              `Case: ${caseRow.ref_code}`,
              `Customer: ${caseRow.customer_name}`,
              cmd.note,
            ]
              .filter(Boolean)
              .join("\n"),
            assigneeEmail: cmd.assignee_email,
            tags: ["tmmt_os", "staff_assign"],
          });
          if (created) {
            clickupUrl = created.url;
            clickupId = created.taskId;
          }
        }

        const updates: Record<string, unknown> = {
          status: cmd.case_status ?? "task_assignment",
          assigned_to: assignee?.id ?? null,
          assigned_at: new Date().toISOString(),
        };
        if (clickupId) {
          updates.clickup_task_id = clickupId;
          updates.clickup_task_url = clickupUrl;
        }

        const { error } = await supabase.from("cases").update(updates).eq("id", caseRow.id);
        if (error) throw new Error(error.message);

        revalidatePath(`/internal/cases/${caseRow.id}`);
        revalidatePath("/internal/cases");

        const links = [
          { label: "Open case", href: `/internal/cases/${caseRow.id}` },
          ...(clickupUrl ? [{ label: "ClickUp task", href: clickupUrl }] : []),
        ];

        return {
          action: cmd.action,
          ok: true,
          message: `Assigned ${cmd.assignee_email} to ${caseRow.ref_code}${clickupUrl ? " + ClickUp task" : ""}.`,
          links,
          data: { case_id: caseRow.id, clickup_task_id: clickupId },
        };
      }

      case "assign_vendor": {
        const caseRow = await resolveCase(supabase, {
          case_id: cmd.case_id,
          case_ref: cmd.case_ref,
        });
        if (!caseRow) {
          return { action: cmd.action, ok: false, message: "Case not found." };
        }
        const vendor = await resolveVendorByName(supabase, cmd.vendor_name);
        if (!vendor) {
          return { action: cmd.action, ok: false, message: `No vendor matching "${cmd.vendor_name}".` };
        }

        const { data: job, error: jobErr } = await supabase
          .from("vendor_jobs")
          .insert({
            case_id: caseRow.id,
            vendor_id: vendor.id,
            title: cmd.title ?? caseRow.subject,
            offered_price: cmd.offered_price ?? null,
            due_at: cmd.due_at ?? null,
            status: "offered",
          })
          .select("id")
          .single();
        if (jobErr) throw new Error(jobErr.message);

        await supabase.from("cases").update({ status: "vendor_assigned" }).eq("id", caseRow.id);
        await supabase.from("activity_logs").insert({
          actor_id: actor?.id ?? null,
          entity: "vendor_job",
          entity_id: job.id,
          action: "created",
          data: { case_id: caseRow.id, vendor_id: vendor.id, via: "ops_command" },
        });

        revalidatePath(`/internal/cases/${caseRow.id}`);

        return {
          action: cmd.action,
          ok: true,
          message: `Offered job to ${vendor.company_name} on ${caseRow.ref_code}.`,
          links: [{ label: "Open case", href: `/internal/cases/${caseRow.id}` }],
          data: { job_id: job.id, vendor_id: vendor.id },
        };
      }

      case "advance_case": {
        const caseRow = await resolveCase(supabase, {
          case_id: cmd.case_id,
          case_ref: cmd.case_ref,
        });
        if (!caseRow) {
          return { action: cmd.action, ok: false, message: "Case not found." };
        }
        const { error: stErr } = await supabase
          .from("cases")
          .update({ status: cmd.to })
          .eq("id", caseRow.id);
        if (stErr) throw new Error(stErr.message);
        await supabase.from("activity_logs").insert({
          actor_id: actor?.id ?? null,
          entity: "case",
          entity_id: caseRow.id,
          action: "status_changed",
          data: { to: cmd.to, note: cmd.note, via: "ops_command" },
        });
        revalidatePath(`/internal/cases/${caseRow.id}`);
        revalidatePath("/internal/cases");
        return {
          action: cmd.action,
          ok: true,
          message: `Case ${caseRow.ref_code} → ${cmd.to}.`,
          links: [{ label: "Open case", href: `/internal/cases/${caseRow.id}` }],
        };
      }

      case "approve_sync": {
        let syncId = cmd.sync_record_id;
        if (!syncId && cmd.customer_email) {
          const { data: row } = await supabase
            .from("crm_sync_records")
            .select("id")
            .ilike("customer_email", cmd.customer_email.trim())
            .in("sync_status", ["pending_airtable", "pending_verification"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          syncId = row?.id;
        }
        if (!syncId) {
          return { action: cmd.action, ok: false, message: "No pending CRM sync for that email." };
        }

        const result = await applyVerifiedSync({
          syncRecordId: syncId,
          verifiedBy: actor?.email ?? actor?.id ?? "ops_command",
        });

        revalidatePath("/internal/sync");
        return {
          action: cmd.action,
          ok: true,
          message: "CRM sync approved and applied.",
          links: [
            { label: "Sync record", href: `/internal/sync/${syncId}` },
            ...(result.caseId
              ? [{ label: "Case", href: `/internal/cases/${result.caseId}` }]
              : []),
          ],
          data: { sync_record_id: syncId, case_id: result.caseId },
        };
      }

      case "post_ledger": {
        const caseRow = await resolveCase(supabase, {
          case_id: cmd.case_id,
          case_ref: cmd.case_ref,
          customer_email: cmd.customer_email,
        });
        const amountCents = Math.round(cmd.amount * 100);
        const { data: row, error } = await supabase
          .from("rental_ledger")
          .insert({
            customer_email: cmd.customer_email.trim().toLowerCase(),
            customer_name: cmd.customer_name ?? caseRow?.customer_name ?? null,
            entry_type: cmd.entry_type,
            status: "completed",
            title: cmd.title,
            amount_cents: amountCents,
            visible_to_client: cmd.visible_to_client,
            source: "team",
            created_by: actor?.id ?? null,
            case_id: caseRow?.id ?? null,
            metadata: { posted_via: "ops_command" },
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);

        revalidatePath("/client/billing");
        revalidatePath("/internal/ledger");

        return {
          action: cmd.action,
          ok: true,
          message: `Posted $${cmd.amount.toFixed(2)} to ${cmd.customer_email}${cmd.visible_to_client ? " (visible on billing)" : ""}.`,
          links: [
            { label: "Finance", href: "/internal/ledger" },
            { label: "Client billing", href: "/client/billing" },
          ],
          data: { ledger_id: row.id },
        };
      }

      default:
        return { action: "unknown", ok: false, message: "Unknown command." };
    }
  } catch (e) {
    return {
      action: cmd.action,
      ok: false,
      message: e instanceof Error ? e.message : "Command failed",
    };
  }
}

export async function executeOpsCommands(args: {
  supabase: SupabaseClient;
  commands?: OpsCommand[];
  message?: string;
  actor?: { id: string; email?: string | null };
}): Promise<OpsCommandResponse> {
  let commands = args.commands ?? [];
  let parsedFromMessage = false;

  if (commands.length === 0 && args.message?.trim()) {
    commands = parseOpsMessage(args.message);
    parsedFromMessage = true;
  }

  if (commands.length === 0) {
    return {
      ok: false,
      parsed_from_message: parsedFromMessage,
      results: [
        {
          action: "help",
          ok: false,
          message:
            "Could not parse that. Try: “assign maria@tmmt.com to case TMMT-ABC123”, “approve crm for renter@email.com”, “post $45 expense to renter@email.com for detail show billing”, “what's pending”.",
        },
      ],
    };
  }

  const results: OpsCommandResult[] = [];
  for (const cmd of commands) {
    results.push(await runOne(args.supabase, cmd, args.actor));
  }

  return {
    ok: results.every((r) => r.ok),
    parsed_from_message: parsedFromMessage,
    results,
  };
}

export { parseOpsMessage };
