import "server-only";
import { getDashboardData } from "@/lib/queries";
import { notifyTelegram } from "@/lib/notify-telegram";
import { createSSRClient } from "@/lib/supabase-server";
import { buildOwnerMissionData } from "./build";
import { renderMissionForTelegram } from "./render-telegram";
import { fanOutMissionToChats } from "./fan-out";

export { fanOutMissionToChats };

export type SendMissionResult = {
  built: boolean;
  notified: boolean;
  reason?: string;
  chars?: number;
  preview?: string;
};

export type FanOutResult = {
  built: boolean;
  recipients: number;
  sent: number;
  failed: number;
  chars: number;
  preview?: string;
  reason?: string;
};

export async function sendOwnerMissionToTelegram(opts: {
  notify: boolean;
  greetingName?: string;
  now?: Date;
}): Promise<SendMissionResult> {
  const dash = await getDashboardData();
  const data = buildOwnerMissionData(dash, opts.greetingName ?? "Owner");
  const text = renderMissionForTelegram(data, opts.now ?? new Date());

  if (!opts.notify) {
    return { built: true, notified: false, reason: "notify=false", chars: text.length, preview: text };
  }

  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!chatId) {
    return { built: true, notified: false, reason: "TELEGRAM_OWNER_CHAT_ID not set", chars: text.length };
  }

  const ok = await notifyTelegram({ chatId, text });
  return {
    built: true,
    notified: ok,
    reason: ok ? undefined : "telegram send failed (see server logs)",
    chars: text.length,
  };
}

export async function sendMissionToTeam(opts: {
  notify: boolean;
  greetingName?: string;
  now?: Date;
}): Promise<FanOutResult> {
  const dash = await getDashboardData();
  const data = buildOwnerMissionData(dash, opts.greetingName ?? "Owner");
  const text = renderMissionForTelegram(data, opts.now ?? new Date());

  const supabase = await createSSRClient();
  const { data: rows, error } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (error) {
    return {
      built: true,
      recipients: 0,
      sent: 0,
      failed: 0,
      chars: text.length,
      reason: `profiles query failed: ${error.message}`,
    };
  }

  const chatIds = (rows ?? [])
    .map((r) => r.telegram_chat_id as string | null)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (!opts.notify) {
    return {
      built: true,
      recipients: chatIds.length,
      sent: 0,
      failed: 0,
      chars: text.length,
      preview: text,
      reason: "notify=false",
    };
  }

  const { sent, failed } = await fanOutMissionToChats(chatIds, text, notifyTelegram);
  return {
    built: true,
    recipients: chatIds.length,
    sent,
    failed,
    chars: text.length,
  };
}
