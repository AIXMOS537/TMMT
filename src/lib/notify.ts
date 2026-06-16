import "server-only";

/**
 * Lightweight assignee notification. Reuses the dispatch-core Telegram channel
 * (TELEGRAM_BOT_TOKEN + profiles.telegram_chat_id). Fail-open: returns false
 * instead of throwing, so a missing token or chat id never breaks routing.
 */
export async function notifyTelegram(
  chatId: string | null | undefined,
  text: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[notify] telegram failed:", (err as Error).message);
    return false;
  }
}
