import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ extractMoneyFieldsWithAI: vi.fn() }));

vi.mock("./ai-extract", () => ({
  extractMoneyFieldsWithAI: mocks.extractMoneyFieldsWithAI,
  isAiExtractionEnabled: () => true,
}));

import { extractListingsFromEmail } from "./email-alert-parsing";
import { extractFetchedListingsFromEmail } from "./email-alert-parsing";
import { blankNormalizedListing } from "@/types/listing";

describe("email alert AI money extraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges AI fields without overriding the existing price heuristic", async () => {
    mocks.extractMoneyFieldsWithAI.mockResolvedValue({
      deposit: {
        amount: 3_000,
        confidence: "ESTIMATE",
        sourceText: "Kaution EUR 3.000",
      },
    });
    const url = "https://example.test/listing/123";

    const [listing] = await extractListingsFromEmail(
      `Miete EUR 1250,00, Kaution EUR 3.000 ${url}`,
      /https:\/\/example\.test\/listing\/\d+/,
      /\/listing\/(\d+)/,
    );

    expect(listing.baseRent).toMatchObject({
      amount: 1250,
      confidence: "ESTIMATE",
    });
    expect(listing.deposit).toEqual({
      amount: 3_000,
      confidence: "ESTIMATE",
      sourceText: "Kaution EUR 3.000",
    });
    expect(mocks.extractMoneyFieldsWithAI.mock.calls[0][1]).not.toContain(
      "baseRent",
    );
  });
});

it("fetches email listings and falls back to URL metadata per failed URL", async () => {
  const fetched = "https://example.test/listing/123";
  const failed = "https://example.test/listing/456";
  const listings = await extractFetchedListingsFromEmail(
    `${fetched} ${failed}`,
    /https:\/\/example\.test\/listing\/\d+/,
    /\/listing\/(\d+)/,
    async (url) => {
      if (url === failed) throw new Error("network failed");
      return {
        ...blankNormalizedListing,
        title: "Fetched listing",
        canonicalUrl: url,
        sourceListingId: "123",
        importMethod: "URL_METADATA",
      };
    },
  );

  expect(listings).toHaveLength(2);
  expect(listings[0]).toMatchObject({
    title: "Fetched listing",
    importMethod: "EMAIL_ALERT",
  });
  expect(listings[1]).toMatchObject({
    sourceListingId: "456",
    importMethod: "EMAIL_ALERT",
  });
});
