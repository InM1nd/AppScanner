import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScraperWorkerFallback } from "./remote-fetch";

const mocks = vi.hoisted(() => ({
  safeFetchText: vi.fn(),
  fetchViaWorker: vi.fn(),
}));

vi.mock("./safe-fetch", () => ({ safeFetchText: mocks.safeFetchText }));
vi.mock("./remote-fetch", () => ({ fetchViaWorker: mocks.fetchViaWorker }));

import { isFetchAllowedByRobots } from "./robots";

const UA = "Mozilla/5.0 Test";
const fallback: ScraperWorkerFallback = {
  config: { url: "https://worker.example/v1/fetch", secret: "s" },
  transports: ["curl"],
};

describe("isFetchAllowedByRobots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a path with no matching disallow rule (no worker needed)", async () => {
    mocks.safeFetchText.mockResolvedValue("User-agent: *\nAllow: /");
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA),
    ).resolves.toBe(true);
    expect(mocks.fetchViaWorker).not.toHaveBeenCalled();
  });

  it("blocks a disallowed path when no worker fallback is configured", async () => {
    mocks.safeFetchText.mockResolvedValue("User-agent: *\nDisallow: /expose");
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA),
    ).resolves.toBe(false);
  });

  it("re-checks via the worker when native robots.txt disallows, and allows if the worker's read is permissive", async () => {
    mocks.safeFetchText.mockResolvedValue("User-agent: *\nDisallow: /expose");
    mocks.fetchViaWorker.mockResolvedValue({
      html: "User-agent: *\nAllow: /",
      finalUrl: "https://example.test/robots.txt",
      transport: "curl",
      status: 200,
    });
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA, fallback),
    ).resolves.toBe(true);
    expect(mocks.fetchViaWorker).toHaveBeenCalledTimes(1);
  });

  it("stays blocked if the worker's robots.txt also disallows the path", async () => {
    mocks.safeFetchText.mockResolvedValue("User-agent: *\nDisallow: /expose");
    mocks.fetchViaWorker.mockResolvedValue({
      html: "User-agent: *\nDisallow: /expose",
      finalUrl: "https://example.test/robots.txt",
      transport: "curl",
      status: 200,
    });
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA, fallback),
    ).resolves.toBe(false);
  });

  it("fails open (allows) when native robots.txt fetch throws and no worker is configured", async () => {
    mocks.safeFetchText.mockRejectedValue(new Error("network error"));
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA),
    ).resolves.toBe(true);
  });

  it("tries the worker when native robots.txt fetch throws and a worker is configured", async () => {
    mocks.safeFetchText.mockRejectedValue(new Error("network error"));
    mocks.fetchViaWorker.mockResolvedValue({
      html: "User-agent: *\nDisallow: /expose",
      finalUrl: "https://example.test/robots.txt",
      transport: "curl",
      status: 200,
    });
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA, fallback),
    ).resolves.toBe(false);
  });

  it("falls open if both native and worker robots.txt fetches fail", async () => {
    mocks.safeFetchText.mockRejectedValue(new Error("network error"));
    mocks.fetchViaWorker.mockRejectedValue(new Error("worker down"));
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA, fallback),
    ).resolves.toBe(true);
  });

  it("doesn't let an unrelated directive between '*' and a later named-bot group merge the two (real ImmoScout24.at robots.txt shape)", async () => {
    mocks.safeFetchText.mockResolvedValue(
      [
        "User-agent: ChatGPT-User",
        "Allow: /",
        "",
        "User-Agent: *",
        "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
        "",
        "Sitemap: https://example.test/sitemap.xml",
        "",
        "User-agent: MJ12bot",
        "Disallow: /expose",
        "",
        "User-agent: AhrefsBot",
        "Disallow: /expose",
      ].join("\n"),
    );
    await expect(
      isFetchAllowedByRobots("https://example.test/expose/1", UA),
    ).resolves.toBe(true);
  });
});
