import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWillhabenListing } from "./willhaben";

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
});
