import { expect, it } from "vitest";
import { buildUrlOnlyDraft, matchesProviderHost } from "./url-only-listing";

it("does not fabricate facts from an URL slug", () => {
  const listing = buildUrlOnlyDraft(
    "https://example.test/cheap-perfect-flat-1140/123456",
    /\/(\d+)$/,
  );

  expect(listing).toMatchObject({
    title: "Imported listing (needs review)",
    importMethod: "URL_METADATA",
    postalCode: "1140",
    district: 14,
    rooms: null,
    baseRent: { amount: null, confidence: "UNKNOWN", sourceText: null },
  });
});

it("matches provider hosts without accepting suffix lookalikes", () => {
  expect(
    matchesProviderHost("https://www.example.test/x", ["example.test"]),
  ).toBe(true);
  expect(
    matchesProviderHost("https://example.test.evil.test/x", ["example.test"]),
  ).toBe(false);
});
