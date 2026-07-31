import { describe, expect, it } from "vitest";
import {
  findDuplicateMatch,
  normalizeCanonicalUrl,
  type DuplicateCandidate,
} from "@/lib/duplicate";

function makeListing(
  overrides: Partial<DuplicateCandidate>,
): DuplicateCandidate {
  return {
    id: "cand",
    providerId: "provider-a",
    sourceListingId: null,
    canonicalUrl: "https://example.com/1",
    address: "Hütteldorfer Straße 50",
    district: 15,
    rooms: 2,
    squareMeters: 55,
    baseRentAmount: 850,
    ...overrides,
  };
}

describe("findDuplicateMatch", () => {
  it("detects an exact URL match", () => {
    const existing = [
      makeListing({ id: "existing", canonicalUrl: "https://example.com/1" }),
    ];
    const candidate = makeListing({
      id: "cand",
      canonicalUrl: "https://example.com/1",
    });
    const match = findDuplicateMatch(candidate, existing);
    expect(match?.reason).toBe("SAME_URL");
  });

  it("normalizes protocol, host, tracking parameters, query order and trailing slash", () => {
    expect(
      normalizeCanonicalUrl(
        "http://www.Example.com/listing/1/?utm_source=x&b=2&a=1#photos",
      ),
    ).toBe("https://example.com/listing/1?a=1&b=2");
    const existing = [
      makeListing({
        id: "existing",
        canonicalUrl: "https://example.com/listing/1?a=1&b=2",
      }),
    ];
    const candidate = makeListing({
      canonicalUrl: "http://www.example.com/listing/1/?b=2&utm_campaign=x&a=1",
    });
    expect(findDuplicateMatch(candidate, existing)?.reason).toBe("SAME_URL");
  });

  it("detects the same provider + source listing id", () => {
    const existing = [
      makeListing({
        id: "existing",
        providerId: "willhaben",
        sourceListingId: "123",
        canonicalUrl: "https://x/a",
      }),
    ];
    const candidate = makeListing({
      id: "cand",
      providerId: "willhaben",
      sourceListingId: "123",
      canonicalUrl: "https://x/b",
    });
    const match = findDuplicateMatch(candidate, existing);
    expect(match?.reason).toBe("SAME_PROVIDER_SOURCE_ID");
  });

  it("detects cross-provider duplicates via similar address, rooms, price", () => {
    const existing = [
      makeListing({
        id: "existing",
        providerId: "willhaben",
        canonicalUrl: "https://willhaben.at/x",
        address: "Hütteldorfer Str. 50, 1150 Wien",
        baseRentAmount: 860,
      }),
    ];
    const candidate = makeListing({
      id: "cand",
      providerId: "immoscout",
      canonicalUrl: "https://immobilienscout24.at/y",
      address: "Hütteldorfer Straße 50",
      baseRentAmount: 850,
    });
    const match = findDuplicateMatch(candidate, existing);
    expect(match?.reason).toBe("SIMILAR_ADDRESS_AND_PRICE");
    expect(match?.confidence).toBeGreaterThan(0.5);
    expect(match?.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it("does not match dissimilar addresses", () => {
    const existing = [
      makeListing({
        id: "existing",
        canonicalUrl: "https://example.com/existing",
        address: "Mariahilfer Straße 100",
      }),
    ];
    const candidate = makeListing({
      id: "cand",
      canonicalUrl: "https://example.com/cand",
      address: "Hütteldorfer Straße 50",
    });
    expect(findDuplicateMatch(candidate, existing)).toBeNull();
  });

  it("does not match same address but very different price", () => {
    const existing = [
      makeListing({
        id: "existing",
        canonicalUrl: "https://example.com/existing",
        baseRentAmount: 800,
      }),
    ];
    const candidate = makeListing({
      id: "cand",
      canonicalUrl: "https://example.com/cand",
      baseRentAmount: 1400,
    });
    expect(findDuplicateMatch(candidate, existing)).toBeNull();
  });

  it("ignores itself when present in the existing pool", () => {
    const existing = [makeListing({ id: "cand" })];
    const candidate = makeListing({ id: "cand" });
    expect(findDuplicateMatch(candidate, existing)).toBeNull();
  });

  it("does not treat missing fuzzy evidence as a match", () => {
    const existing = [
      makeListing({
        id: "existing",
        canonicalUrl: "https://example.com/other",
        rooms: null,
        squareMeters: null,
      }),
    ];
    const candidate = makeListing({
      canonicalUrl: "https://example.com/candidate",
      rooms: null,
      squareMeters: null,
    });
    expect(findDuplicateMatch(candidate, existing)).toBeNull();
  });

  it("chooses the strongest exact match instead of the first match", () => {
    const existing = [
      makeListing({
        id: "url-match",
        canonicalUrl: "https://example.com/1",
        sourceListingId: "other",
      }),
      makeListing({
        id: "source-match",
        canonicalUrl: "https://example.com/2",
        sourceListingId: "123",
      }),
    ];
    const candidate = makeListing({ sourceListingId: "123" });
    expect(findDuplicateMatch(candidate, existing)).toMatchObject({
      matchedListingId: "source-match",
      reason: "SAME_PROVIDER_SOURCE_ID",
    });
  });
});
