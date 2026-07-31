import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramMessage } from "../telegram";

describe("sendTelegramMessage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends bounded plain text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTelegramMessage("token", "chat", "x".repeat(5000)),
    ).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.text).toHaveLength(4096);
    expect(body.parse_mode).toBeUndefined();
  });

  it("reports Telegram throttling details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            description: "Too Many Requests",
            parameters: { retry_after: 12 },
          }),
          { status: 429 },
        ),
      ),
    );

    await expect(
      sendTelegramMessage("token", "chat", "hello"),
    ).resolves.toEqual({
      ok: false,
      error: "Too Many Requests Retry after 12s.",
    });
  });
});
