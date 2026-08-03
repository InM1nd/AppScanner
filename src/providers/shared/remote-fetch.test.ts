import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkerSignature,
  fetchViaWorker,
} from "@/providers/shared/remote-fetch";
import { envSchema } from "@/lib/env";

describe("scraper worker client", () => {
  it("V18 requires a strong shared secret when enabled", () => {
    expect(
      envSchema.safeParse({
        SCRAPER_WORKER_ENABLED: "true",
        SCRAPER_WORKER_URL: "https://worker.example",
        SCRAPER_WORKER_SECRET: "weak",
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        SCRAPER_WORKER_ENABLED: "true",
        SCRAPER_WORKER_URL: "https://worker.example",
        SCRAPER_WORKER_SECRET: "x".repeat(32),
      }).success,
    ).toBe(true);
  });

  it("V18 signs the exact timestamp and request body", () => {
    const body = JSON.stringify({
      url: "https://www.immobilienscout24.at/expose/1",
      transports: ["curl", "browser"],
    });
    const expected = createHmac("sha256", "secret")
      .update(`1700000000.${body}`)
      .digest("hex");

    expect(createWorkerSignature("secret", "1700000000", body)).toBe(expected);
  });

  it("V19 returns bounded worker HTML and its winning transport", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          html: "<html>listing</html>",
          finalUrl: "https://www.immobilienscout24.at/expose/1",
          transport: "browser",
          status: 200,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await fetchViaWorker(
      "https://www.immobilienscout24.at/expose/1",
      ["curl", "browser"],
      { url: "https://worker.example/v1/fetch", secret: "secret" },
      fetchImpl,
      1_700_000_000_000,
    );

    expect(result).toEqual({
      html: "<html>listing</html>",
      finalUrl: "https://www.immobilienscout24.at/expose/1",
      transport: "browser",
      status: 200,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("V20 enforces the response limit in bytes, not characters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          html: "🏠".repeat(600_000),
          finalUrl: "https://www.immobilienscout24.at/expose/1",
          transport: "curl",
          status: 200,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      fetchViaWorker(
        "https://www.immobilienscout24.at/expose/1",
        ["curl"],
        { url: "https://worker.example/v1/fetch", secret: "x".repeat(32) },
        fetchImpl,
      ),
    ).rejects.toThrow("exceeds 2.1 MB");
  });
});
