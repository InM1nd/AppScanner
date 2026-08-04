import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonListingPageError } from "@/types/provider";

const mocks = vi.hoisted(() => ({
  fetchHtml: vi.fn(),
  fillUnknownMoneyFacts: vi.fn(),
}));

vi.mock("./shared/fetch-html", () => ({ fetchHtml: mocks.fetchHtml }));
vi.mock("./shared/ai-extract", () => ({
  fillUnknownMoneyFacts: mocks.fillUnknownMoneyFacts,
}));

import { parseWillhabenListing, willhabenProvider } from "./willhaben";

const html = readFileSync(
  new URL("../../fixtures/providers/willhaben-detail.html", import.meta.url),
  "utf8",
);
const url =
  "https://www.willhaben.at/iad/immobilien/d/mietwohnungen/wien/wien-1150-rudolfsheim-fuenfhaus/ruhige-zweizimmerwohnung-825052636";

describe("parseWillhabenListing", () => {
  it("keeps the published total separate and extracts only explicit facts", () => {
    const listing = parseWillhabenListing(html, url);

    expect(listing.advertisedMonthlyTotal).toMatchObject({
      amount: 950,
      confidence: "EXACT",
    });
    expect(listing.baseRent).toEqual({
      amount: null,
      confidence: "UNKNOWN",
      sourceText: null,
    });
    expect(listing.operatingCosts.amount).toBe(87);
    expect(listing.deposit.amount).toBe(2850);
    expect(listing.commission.amount).toBe(0);
    expect(listing.hasSeparateBedroom).toBe("YES");
    expect(listing.kitchen).toBe("FITTED");
    expect(listing.washingMachine).toBe("MACHINE_INCLUDED");
    expect(listing.contractType).toBe("UNLIMITED");
    expect(listing.quietCourtyardSignal).toBe("YES");
    expect(listing.newerOrRenovatedSignal).toBe("YES");
  });

  it("does not turn a washing-machine connection into an included machine", () => {
    const connectionOnly = html.replace(
      "Eine Einbauküche und eine Waschmaschine bleiben in der Wohnung.",
      "Eine Einbauküche und ein Waschmaschinenanschluss sind vorhanden.",
    );
    expect(parseWillhabenListing(connectionOnly, url).washingMachine).toBe(
      "CONNECTION_ONLY",
    );
  });

  it("classifies an explicitly advertised WG room as shared housing", () => {
    const sharedRoom = html.replace(
      "Ruhige Zweizimmerwohnung - willhaben",
      "WG-Zimmer in einer Wohngemeinschaft - willhaben",
    );
    expect(parseWillhabenListing(sharedRoom, url).listingType).toBe(
      "SHARED_ROOM",
    );
  });

  it("classifies an expired result as a non-listing page", () => {
    const expired = html.replace('"advertDetails": {', '"expiredDetails": {');
    expect(() => parseWillhabenListing(expired, url)).toThrow(
      NonListingPageError,
    );
  });

  it("flags a soft-gone page (200 OK, 'no longer available' notice) as GONE", () => {
    const gone = `<div>Diese Anzeige ist nicht mehr verfügbar</div>${html}`;
    try {
      parseWillhabenListing(gone, url);
      expect.unreachable("expected parseWillhabenListing to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(NonListingPageError);
      expect((error as InstanceType<typeof NonListingPageError>).reason).toBe(
        "GONE",
      );
    }
  });

  it("flags an already-rented page as RESERVED", () => {
    const rented = `<div>Dieses Objekt ist bereits vermietet.</div>${html}`;
    try {
      parseWillhabenListing(rented, url);
      expect.unreachable("expected parseWillhabenListing to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(NonListingPageError);
      expect((error as InstanceType<typeof NonListingPageError>).reason).toBe(
        "RESERVED",
      );
    }
  });
});

describe("willhabenProvider.importFromUrl AI fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills fields the structured parse left unknown, without touching what it already found", async () => {
    mocks.fetchHtml.mockResolvedValue(html);
    mocks.fillUnknownMoneyFacts.mockResolvedValue({
      baseRent: {
        amount: 863,
        confidence: "ESTIMATE",
        sourceText: "Grundmiete laut Beschreibung 863 Euro",
      },
    });

    const listing = await willhabenProvider.importFromUrl(url);

    expect(listing.baseRent).toEqual({
      amount: 863,
      confidence: "ESTIMATE",
      sourceText: "Grundmiete laut Beschreibung 863 Euro",
    });
    // Structurally-parsed facts still come straight from the page, untouched.
    expect(listing.operatingCosts.amount).toBe(87);
    expect(listing.deposit.amount).toBe(2850);

    const [passedFacts, passedText] = mocks.fillUnknownMoneyFacts.mock.calls[0];
    expect(passedFacts.operatingCosts.amount).toBe(87);
    expect(passedText).toBe(listing.description);
  });
});
