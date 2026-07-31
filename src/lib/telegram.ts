// Thin wrapper around the official Telegram Bot API sendMessage endpoint.
// No polling, no webhook — this app only ever sends, driven entirely by
// env vars (TELEGRAM_ENABLED/TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID).

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

const TELEGRAM_TEXT_LIMIT = 4096;
const TELEGRAM_TIMEOUT_MS = 10_000;

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, TELEGRAM_TEXT_LIMIT),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      },
    );
    const body = (await res.json()) as {
      ok?: boolean;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (!res.ok || body.ok !== true) {
      const retry = body.parameters?.retry_after
        ? ` Retry after ${body.parameters.retry_after}s.`
        : "";
      return {
        ok: false,
        error: `${body.description ?? `HTTP ${res.status}`}${retry}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown network error.",
    };
  }
}

export function isTelegramConfigured(): boolean {
  return (
    process.env.TELEGRAM_ENABLED === "true" &&
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    Boolean(process.env.TELEGRAM_CHAT_ID)
  );
}
