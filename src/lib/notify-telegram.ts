import "server-only";

const TG_BASE = "https://api.telegram.org";

export async function notifyTelegram(opts: {
  chatId: string;
  text: string;
  silent?: boolean;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[notify] TELEGRAM_BOT_TOKEN not set; skipping");
    return false;
  }
  try {
    const res = await fetch(`${TG_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        disable_notification: opts.silent ?? false,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[notify] failed", (err as Error).message);
    return false;
  }
}

export async function notifyResponder(opts: {
  responderId: string | null;
  text: string;
  fetchChatId: (uid: string) => Promise<string | null>;
}): Promise<boolean> {
  let chatId: string | null = null;
  if (opts.responderId) chatId = await opts.fetchChatId(opts.responderId);
  chatId ??= process.env.TELEGRAM_OWNER_CHAT_ID ?? null;
  if (!chatId) return false;
  return notifyTelegram({ chatId, text: opts.text });
}
