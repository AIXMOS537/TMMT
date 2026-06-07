import { z } from "zod";

export const OpsCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign_staff"),
    assignee_email: z.string().email(),
    case_ref: z.string().optional(),
    case_id: z.string().uuid().optional(),
    customer_email: z.string().email().optional(),
    title: z.string().optional(),
    note: z.string().optional(),
    /** When set (e.g. GHL auto-ops), use this case status instead of task_assignment */
    case_status: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("assign_vendor"),
    vendor_name: z.string().min(1),
    case_ref: z.string().optional(),
    case_id: z.string().uuid().optional(),
    title: z.string().optional(),
    offered_price: z.number().optional(),
    due_at: z.string().optional(),
  }),
  z.object({
    action: z.literal("advance_case"),
    to: z.string().min(1),
    case_ref: z.string().optional(),
    case_id: z.string().uuid().optional(),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal("approve_sync"),
    customer_email: z.string().email().optional(),
    sync_record_id: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("post_ledger"),
    customer_email: z.string().email(),
    amount: z.number().positive(),
    title: z.string().min(1),
    entry_type: z
      .enum(["deposit", "deposit_return", "payment", "deduction", "expense", "refund"])
      .default("expense"),
    visible_to_client: z.boolean().default(true),
    customer_name: z.string().optional(),
    case_ref: z.string().optional(),
    case_id: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("summary"),
  }),
]);

export type OpsCommand = z.infer<typeof OpsCommandSchema>;

export type OpsCommandResult = {
  action: string;
  ok: boolean;
  message: string;
  links?: { label: string; href: string }[];
  data?: Record<string, unknown>;
};

export type OpsCommandResponse = {
  ok: boolean;
  parsed_from_message?: boolean;
  results: OpsCommandResult[];
};
