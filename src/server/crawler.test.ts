import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeCanonicalUrl } from "@/lib/duplicate";
import { NonListingPageError } from "@/types/provider";

const mocks = vi.hoisted(() => ({
  savedSearchFindMany: vi.fn(),
  listingFindMany: vi.fn(),
  providerUpdate: vi.fn(),
  getProviderAdapter: vi.fn(),
  createListingFromDraft: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    savedSearch: { findMany: mocks.savedSearchFindMany },
    listing: { findMany: mocks.listingFindMany },
    provider: { update: mocks.providerUpdate },
  },
}));
vi.mock("@/providers", () => ({
  getProviderAdapter: mocks.getProviderAdapter,
}));
vi.mock("./listings", () => ({
  createListingFromDraft: mocks.createListingFromDraft,
  DuplicateListingError: class DuplicateListingError extends Error {},
}));

import { listCrawlerSavedSearchIds, runSearchCrawler } from "./crawler";

const savedSearch = {
  id: "search-1",
  providerId: "provider-1",
  label: "Vienna",
  searchUrl: "https://example.com/search?sort=3",
  provider: { name: "WILLHABEN", isEnabled: true },
};

describe("crawler progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerUpdate.mockResolvedValue({});
    mocks.createListingFromDraft.mockResolvedValue({ id: "listing" });
  });

  it("skips known URLs before spending the detail-fetch cap", async () => {
    const urls = Array.from(
      { length: 30 },
      (_, index) => `https://example.com/listing/${index + 1}`,
    );
    mocks.savedSearchFindMany.mockResolvedValue([savedSearch]);
    mocks.listingFindMany.mockResolvedValue(
      urls.slice(0, 15).map((url) => ({
        normalizedCanonicalUrl: normalizeCanonicalUrl(url),
      })),
    );
    mocks.getProviderAdapter.mockReturnValue({
      async *discoverListingUrls() {
        yield* urls;
      },
      importFromUrl: vi.fn(async (url: string) => ({
        canonicalUrl: url,
        sourceListingId: url.split("/").at(-1),
      })),
    });

    const summary = await runSearchCrawler(savedSearch.id);

    expect(summary).toMatchObject({ found: 15, saved: 15, duplicates: 15 });
    expect(mocks.createListingFromDraft).toHaveBeenCalledTimes(15);
    expect(
      mocks.createListingFromDraft.mock.calls[0][0].draft.canonicalUrl,
    ).toBe(urls[15]);
  });

  it("schedules every unique saved search", async () => {
    mocks.savedSearchFindMany.mockResolvedValue([
      {
        id: "one",
        providerId: "p1",
        searchUrl: "https://example.com/?b=2&a=1",
      },
      {
        id: "duplicate",
        providerId: "p1",
        searchUrl: "https://example.com/?a=1&b=2",
      },
      {
        id: "two",
        providerId: "p2",
        searchUrl: "https://example.com/?a=1&b=2",
      },
      { id: "three", providerId: "p3", searchUrl: "https://third.example.com" },
    ]);

    await expect(listCrawlerSavedSearchIds()).resolves.toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("marks an all-non-listing crawl as degraded", async () => {
    mocks.savedSearchFindMany.mockResolvedValue([savedSearch]);
    mocks.listingFindMany.mockResolvedValue([]);
    mocks.getProviderAdapter.mockReturnValue({
      async *discoverListingUrls() {
        yield "https://example.com/listing/gone";
      },
      importFromUrl: vi.fn(async () => {
        throw new NonListingPageError("gone", "GONE");
      }),
    });

    await runSearchCrawler(savedSearch.id);

    expect(mocks.providerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          healthStatus: "DEGRADED",
          lastError: "All 1 fetched URLs were classified as non-listings.",
        }),
      }),
    );
  });
});
