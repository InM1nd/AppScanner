import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listingFindUniqueOrThrow: vi.fn(),
  listingUpdate: vi.fn(),
  providerUpdateMany: vi.fn(),
  getProviderAdapter: vi.fn(),
  updateListingFromDraft: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    listing: {
      findUniqueOrThrow: mocks.listingFindUniqueOrThrow,
      update: mocks.listingUpdate,
    },
    provider: { updateMany: mocks.providerUpdateMany },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));
vi.mock("@/providers", () => ({ getProviderAdapter: mocks.getProviderAdapter }));
vi.mock("./listings", () => ({
  updateListingFromDraft: mocks.updateListingFromDraft,
}));

import { refreshSingleListing } from "./refresh";

describe("refreshSingleListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listingUpdate.mockResolvedValue({});
    mocks.providerUpdateMany.mockResolvedValue({});
    mocks.updateListingFromDraft.mockResolvedValue({});
  });

  it("skips AI money extraction on refresh (description text doesn't change between hourly re-fetches)", async () => {
    const importFromUrl = vi.fn(async () => ({ canonicalUrl: "https://x" }));
    mocks.listingFindUniqueOrThrow.mockResolvedValue({
      id: "listing-1",
      providerId: "provider-1",
      canonicalUrl: "https://willhaben.at/iad/some-listing",
      provider: { name: "WILLHABEN", isEnabled: true },
    });
    mocks.getProviderAdapter.mockReturnValue({ importFromUrl });

    await refreshSingleListing("listing-1");

    expect(importFromUrl).toHaveBeenCalledWith(
      "https://willhaben.at/iad/some-listing",
      { skipAiExtraction: true },
    );
  });
});
