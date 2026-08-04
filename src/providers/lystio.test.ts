import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonListingPageError } from "@/types/provider";

const mocks = vi.hoisted(() => ({
  fetchHtml: vi.fn(),
  fillUnknownMoneyFacts: vi.fn(),
}));

vi.mock("./shared/fetch-html", () => ({
  fetchHtml: mocks.fetchHtml,
  BROWSER_USER_AGENT: "test-agent",
}));
vi.mock("./shared/ai-extract", () => ({
  fillUnknownMoneyFacts: mocks.fillUnknownMoneyFacts,
}));

import { parseLystioListing, lystioProvider } from "./lystio";

const html = readFileSync(
  new URL("../../fixtures/providers/lystio-detail.html", import.meta.url),
  "utf8",
);
const url = "https://lystio.at/en/rent/apartment/vienna/bright-apartment/12345";

describe("parseLystioListing", () => {
  it("reads the scoped price breakdown and explicit listing facts", () => {
    const listing = parseLystioListing(html, url);

    expect(listing.advertisedMonthlyTotal.amount).toBe(950);
    expect(listing.baseRent.amount).toBe(863);
    expect(listing.operatingCosts.amount).toBe(87);
    expect(listing.deposit.amount).toBe(2850);
    expect(listing.hasSeparateBedroom).toBe("YES");
    expect(listing.kitchen).toBe("FITTED");
    expect(listing.washingMachine).toBe("CONNECTION_ONLY");
    expect(listing.contractType).toBe("FIXED_TERM");
    expect(listing.furnishedLevel).toBe("PARTLY_FURNISHED");
    expect(listing.elevator).toBe("YES");
    expect(listing.newerOrRenovatedSignal).toBe("YES");
  });

  it("does not trust components that disagree with the published total", () => {
    const mismatch = html.replace(">87€</span>", ">99€</span>");
    const listing = parseLystioListing(mismatch, url);

    expect(listing.advertisedMonthlyTotal.amount).toBe(950);
    expect(listing.baseRent.confidence).toBe("UNKNOWN");
    expect(listing.operatingCosts.confidence).toBe("UNKNOWN");
  });

  it("rejects building pages with aggregate offers", () => {
    const aggregate = html.replace(
      '"@type": "Offer", "price": 950',
      '"@type": "AggregateOffer", "lowPrice": 950',
    );
    expect(() => parseLystioListing(aggregate, url)).toThrow(
      NonListingPageError,
    );
  });

  it("marks an explicit holiday apartment as temporary", () => {
    const temporary = html.replace(
      "Bright apartment near the park",
      "Holiday apartment for short-term stays",
    );
    expect(parseLystioListing(temporary, url).contractType).toBe("TEMPORARY");
  });

  it("flags a soft-gone page (200 OK, 'no longer available' notice) as GONE", () => {
    const gone = `<div>This listing is no longer available.</div>${html}`;
    try {
      parseLystioListing(gone, url);
      expect.unreachable("expected parseLystioListing to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(NonListingPageError);
      expect((error as InstanceType<typeof NonListingPageError>).reason).toBe(
        "GONE",
      );
    }
  });
});

describe("lystioProvider.importFromUrl AI fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills fields the structured parse left unknown, without touching what it already found", async () => {
    mocks.fetchHtml.mockResolvedValue(html);
    mocks.fillUnknownMoneyFacts.mockResolvedValue({
      contractFee: {
        amount: 150,
        confidence: "ESTIMATE",
        sourceText: "Vermittlungsgebühr laut Beschreibung 150 Euro",
      },
    });

    const listing = await lystioProvider.importFromUrl(url);

    expect(listing.contractFee).toEqual({
      amount: 150,
      confidence: "ESTIMATE",
      sourceText: "Vermittlungsgebühr laut Beschreibung 150 Euro",
    });
    // Structurally-parsed facts still come straight from the page, untouched.
    expect(listing.baseRent.amount).toBe(863);
    expect(listing.deposit.amount).toBe(2850);
  });
});
