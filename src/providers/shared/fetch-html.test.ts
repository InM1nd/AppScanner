import { beforeEach, describe, expect, it, vi } from "vitest";
import { SafeFetchError } from "./safe-fetch";

const mocks = vi.hoisted(() => ({
  fetchViaWorker: vi.fn(),
  safeFetchText: vi.fn(),
}));

vi.mock("./robots", () => ({ isFetchAllowedByRobots: vi.fn(() => true) }));
vi.mock("./rate-limit", () => ({ waitForRateLimit: vi.fn() }));
vi.mock("./safe-fetch", async (original) => ({
  ...(await original<typeof import("./safe-fetch")>()),
  safeFetchText: mocks.safeFetchText,
}));
vi.mock("./remote-fetch", () => ({
  fetchViaWorker: mocks.fetchViaWorker,
  getScraperWorkerFallback: () => ({
    config: { url: "https://worker.example/v1/fetch", secret: "x".repeat(32) },
    transports: ["curl", "browser"],
  }),
}));

import { fetchHtml } from "./fetch-html";

describe("fetchHtml worker fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("V19 uses the provider-scoped worker after a native 401", async () => {
    mocks.safeFetchText.mockRejectedValue(
      new SafeFetchError("Fetch failed with status 401."),
    );
    mocks.fetchViaWorker.mockResolvedValue({
      html: "<html>listing</html>",
      finalUrl: "https://www.immobilienscout24.at/expose/1",
      transport: "curl",
      status: 200,
    });

    await expect(
      fetchHtml(
        "https://www.immobilienscout24.at/expose/1",
        ["immobilienscout24.at"],
        true,
      ),
    ).resolves.toBe("<html>listing</html>");
    expect(mocks.fetchViaWorker).toHaveBeenCalledOnce();
  });

  it("V19 does not use the worker unless the provider opts in", async () => {
    const error = new SafeFetchError("Fetch failed with status 401.");
    mocks.safeFetchText.mockRejectedValue(error);

    await expect(
      fetchHtml("https://www.willhaben.at/iad/1", ["willhaben.at"]),
    ).rejects.toBe(error);
    expect(mocks.fetchViaWorker).not.toHaveBeenCalled();
  });
});
