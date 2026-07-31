import { describe, expect, it } from "vitest";
import { validateListingDraft } from "@/lib/validation";
import { blankNormalizedListing, exactFact } from "@/types/listing";

function validDraft() {
  return {
    ...blankNormalizedListing,
    title: "2-Zimmer-Wohnung Rudolfsheim",
    canonicalUrl: "https://example.com/listing/1",
    listingType: "RENTAL" as const,
    rooms: 2,
    kitchen: "FITTED" as const,
    baseRent: exactFact(850),
    operatingCosts: exactFact(120),
    description:
      "Schöne 2-Zimmer-Wohnung mit Einbauküche und Balkon, ruhige Lage.",
    photos: ["https://example.com/photo1.jpg"],
    contactMethod: "office@example.com",
  };
}

describe("validateListingDraft", () => {
  it("accepts a well-formed listing with no warnings", () => {
    const result = validateListingDraft(validDraft());
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("rejects a draft missing required fields", () => {
    const result = validateListingDraft({ ...validDraft(), title: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a malformed canonical URL", () => {
    const result = validateListingDraft({
      ...validDraft(),
      canonicalUrl: "not-a-url",
    });
    expect(result.valid).toBe(false);
  });

  it("warns when there is no kitchen", () => {
    const result = validateListingDraft({
      ...validDraft(),
      kitchen: "NONE" as const,
    });
    expect(result.warnings.some((w) => w.includes("kitchen"))).toBe(true);
  });

  it("warns on shared room / WG listings", () => {
    const result = validateListingDraft({
      ...validDraft(),
      listingType: "SHARED_ROOM" as const,
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("wg"))).toBe(
      true,
    );
  });

  it("warns on implausibly low rent as a scam signal", () => {
    const result = validateListingDraft({
      ...validDraft(),
      rooms: 2,
      baseRent: exactFact(150),
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("scam"))).toBe(
      true,
    );
  });

  it("warns when mandatory costs are entirely unknown", () => {
    const result = validateListingDraft({
      ...validDraft(),
      baseRent: blankNormalizedListing.baseRent,
      operatingCosts: blankNormalizedListing.operatingCosts,
    });
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("unclear")),
    ).toBe(true);
  });

  it("warns on missing photos and contact method", () => {
    const result = validateListingDraft({
      ...validDraft(),
      photos: [],
      contactMethod: null,
    });
    expect(result.warnings.some((w) => w.includes("photo"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("contact"))).toBe(true);
  });
});
