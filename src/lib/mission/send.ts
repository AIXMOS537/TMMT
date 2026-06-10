import "server-only";
import { getDashboardData } from "@/lib/queries";
import { notifyTelegram } from "@/lib/notify-telegram";
import { buildOwnerMissionData } from "./build";
import { renderMissionForTelegram } from "./render-telegram";

export type SendMissionResult = {
  built: boolean;
  notified: boolean;
  reason?: string;
  chars?: number;
  preview?: string;
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
