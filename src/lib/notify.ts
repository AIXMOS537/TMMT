// Lightweight, fail-safe notification fan-out for server-side use only.
// Never throws. Failure of one channel does not affect the other.
// All channels are env-gated — leave the env var unset to skip.

const TIMEOUT_MS = 5000;

async function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
  ]);
}

export async function notifySlack(text: string): Promise<"ok" | "skip" | "fail"> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return "skip";
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
    );
    if (res === "timeout") {
      console.warn("[notify.slack] timeout");
      return "fail";
    }
    if (!res.ok) {
      console.warn(`[notify.slack] http ${res.status}`);
      return "fail";
    }
    return "ok";
  } catch (err) {
    console.warn("[notify.slack] error:", err instanceof Error ? err.message : String(err));
    return "fail";
  }
}

// iMessage relay: per memory, Mac side is at 100.77.126.8:8787 — Tailscale-only.
// To use this from Vercel, expose the relay via a tunnel (Cloudflare Tunnel / ngrok)
// and set IMESSAGE_RELAY_URL to that public URL plus path.
// Expected protocol: POST JSON { to, text }; optional bearer auth via IMESSAGE_RELAY_TOKEN.
export async function notifyIMessage(text: string): Promise<"ok" | "skip" | "fail"> {
  const url = process.env.IMESSAGE_RELAY_URL;
  const to = process.env.IMESSAGE_NOTIFY_TO;
  if (!url || !to) return "skip";
  const token = process.env.IMESSAGE_RELAY_TOKEN;
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to, text }),
      })
    );
    if (res === "timeout") {
      console.warn("[notify.imessage] timeout");
      return "fail";
    }
    if (!res.ok) {
      console.warn(`[notify.imessage] http ${res.status}`);
      return "fail";
    }
    return "ok";
  } catch (err) {
    console.warn("[notify.imessage] error:", err instanceof Error ? err.message : String(err));
    return "fail";
  }
}

// Telegram works from Vercel without a tunnel — uses the public Bot API.
// Reuses TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_ID env vars already set up for dispatch responder pings.
export async function notifyTelegram(text: string): Promise<"ok" | "skip" | "fail"> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chatId) return "skip";
  try {
    const res = await withTimeout(
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      })
    );
    if (res === "timeout") {
      console.warn("[notify.telegram] timeout");
      return "fail";
    }
    if (!res.ok) {
      console.warn(`[notify.telegram] http ${res.status}`);
      return "fail";
    }
    return "ok";
  } catch (err) {
    console.warn("[notify.telegram] error:", err instanceof Error ? err.message : String(err));
    return "fail";
  }
}

export async function fanOut(text: string): Promise<{ slack: string; telegram: string; imessage: string }> {
  const [slack, telegram, imessage] = await Promise.all([
    notifySlack(text),
    notifyTelegram(text),
    notifyIMessage(text),
  ]);
  return { slack, telegram, imessage };
}
