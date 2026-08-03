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

import { parseIS24Listing, immoScout24AtProvider } from "./immoscout24-at";

describe("parseIS24Listing", () => {
  it("V13 persists the advertised monthly total from current IS24 markup", () => {
    const html = `
      <script type="application/ld+json">{
        "@graph": [
          {"@type":"Product","offers":{"@type":"Offer","price":1569.22}},
          {
            "@type":"RealEstateListing",
            "name":"Vienna apartment",
            "url":"https://www.immobilienscout24.at/expose/abc123",
            "address":{"postalCode":"1190","addressLocality":"Wien"},
            "numberOfRooms":2,
            "floorSize":{"value":50.62}
          }
        ]
      }</script>
      <span class="Costs-label-test">Monatliche Kosten</span><span class="Costs-price-test">1.569,22 €</span>
      <span class="Costs-label-test">Miete</span><span class="Costs-price-test">1.392,05 €</span>
      <span class="Costs-label-test">Betriebskosten</span><span class="Costs-price-test">177,17 €</span>
    `;

    const listing = parseIS24Listing(
      html,
      "https://www.immobilienscout24.at/expose/abc123",
    );
    expect(listing.advertisedMonthlyTotal).toMatchObject({
      amount: 1569.22,
      confidence: "EXACT",
    });
    expect(listing.baseRent.amount).toBe(1392.05);
    expect(listing.operatingCosts.amount).toBe(177.17);
  });

  it("keeps the primary offer price when IS24 repeats the monthly-cost label", () => {
    const html = `
      <script type="application/ld+json">{
        "@graph": [
          {"@type":"Product","offers":{"@type":"Offer","price":1180}},
          {
            "@type":"RealEstateListing",
            "name":"Vienna apartment",
            "url":"https://www.immobilienscout24.at/expose/abc123",
            "address":{"postalCode":"1120","addressLocality":"Wien"}
          }
        ]
      }</script>
      <div class="Costs-row-test"><span class="Costs-label-test">Monatliche Kosten</span><span class="Costs-price-row-test"><span class="Costs-price-test">1.180 €</span></span></div>
      <div class="Costs-row-test"><span class="Costs-label-test">Preis pro m²</span><span class="Costs-price-row-test"><span class="Costs-price-test">23,43 €</span></span></div>
      <div class="Costs-row-test"><span class="Costs-label-test">Gesamtbelastung Netto</span><span class="Costs-price-row-test"><span class="Costs-price-test">1.072,73 €</span></span></div>
      <div class="Costs-row-test"><span class="Costs-label-test">USt. Gesamtbelastung</span><span class="Costs-price-row-test"><span class="Costs-price-test">107,27 €</span></span></div>
      <div class="Costs-row-test"><span class="Costs-label-test">Monatliche Kosten</span><span class="Costs-price-row-test"><span class="Costs-price-test">110,81 €</span></span></div>
    `;

    const listing = parseIS24Listing(
      html,
      "https://www.immobilienscout24.at/expose/abc123",
    );
    expect(listing.advertisedMonthlyTotal.amount).toBe(1180);
  });

  it("uses the full Apollo expose payload for scoring facts", () => {
    const apolloState = {
      "Expose:abc123": {
        __typename: "Expose",
        description: {
          descriptionNote:
            "Ruhige hofseitige Neubauwohnung mit Schlafzimmer, Einbauküche, Waschmaschinenanschluss, Kellerabteil und Klimaanlage. Garagenplatz gegen Aufpreis verfügbar. Abwicklungshonorar Hausverwaltung EUR 160,- brutto.",
        },
        priceInformation: {
          primaryPrice: 1180,
          hasCommission: false,
        },
        costs: {
          oneTime: [{ label: "Kaution", price: "3.600 €" }],
          running: [
            { label: "Monatliche Kosten", price: "1.180 €" },
            { label: "Miete", price: "971,99 €" },
            { label: "Betriebskosten", price: "100,74 €" },
          ],
        },
        localization: {
          address: { city: "Wien", zip: "1120" },
        },
        condition: {
          type: "WELL_KEPT",
          firingTypes: [{ label: "Gas", value: "GAS" }],
          energyCertification: {
            heatingDemandClass: { label: "B" },
          },
        },
        fitting: {
          lift: ["LIFT"],
          numberOfParkingSpaces: 0,
        },
        object: {
          availableFrom: "01.10.2026",
          rentalPeriod: "5.0",
          rentalPeriodType: "YEAR",
        },
        area: {
          numberOfBedrooms: 1,
          numberOfBalconies: 1,
          cellarArea: 2.28,
        },
      },
    };
    const html = `
      <script type="application/ld+json">{
        "@graph": [
          {"@type":"Product","offers":{"@type":"Offer","price":1180},"description":"Truncated…"},
          {
            "@type":"RealEstateListing",
            "name":"Vienna apartment",
            "url":"https://www.immobilienscout24.at/expose/abc123",
            "address":{"postalCode":"1120","addressLocality":"Wien"},
            "numberOfRooms":2,
            "floorSize":{"value":50.37}
          }
        ]
      }</script>
      <script>window.__APOLLO_STATE__=${JSON.stringify(apolloState)}</script>
    `;

    const listing = parseIS24Listing(
      html,
      "https://www.immobilienscout24.at/expose/abc123",
    );

    expect(listing.advertisedMonthlyTotal.amount).toBe(1180);
    expect(listing.baseRent.amount).toBe(971.99);
    expect(listing.operatingCosts.amount).toBe(100.74);
    expect(listing.deposit.amount).toBe(3600);
    expect(listing.commission.amount).toBe(0);
    expect(listing.contractFee.amount).toBe(160);
    expect(listing.availabilityDate?.getFullYear()).toBe(2026);
    expect(listing.availabilityDate?.getMonth()).toBe(9);
    expect(listing.availabilityDate?.getDate()).toBe(1);
    expect(listing.contractType).toBe("FIXED_TERM");
    expect(listing.hasSeparateBedroom).toBe("YES");
    expect(listing.kitchen).toBe("FITTED");
    expect(listing.washingMachine).toBe("CONNECTION_ONLY");
    expect(listing.parkingAvailability).toBe("AVAILABLE_EXTRA_COST");
    expect(listing.elevator).toBe("YES");
    expect(listing.balcony).toBe("YES");
    expect(listing.airConditioning).toBe("YES");
    expect(listing.storage).toBe("YES");
    expect(listing.quietCourtyardSignal).toBe("YES");
    expect(listing.newerOrRenovatedSignal).toBe("YES");
    expect(listing.heatingType).toBe("GAS");
    expect(listing.energyRating).toBe("B");
    expect(listing.description).toContain("Einbauküche");
  });

  it("V23 classifies a project page as a non-listing skip", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Project"}</script>`;
    expect(() =>
      parseIS24Listing(html, "https://www.immobilienscout24.at/expose/project"),
    ).toThrow(NonListingPageError);
  });
});

describe("immoScout24AtProvider.importFromUrl AI fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills fields the structured parse left unknown, without touching what it already found", async () => {
    const html = `
      <script type="application/ld+json">{
        "@graph": [
          {"@type":"Product","offers":{"@type":"Offer","price":1569.22}},
          {
            "@type":"RealEstateListing",
            "name":"Vienna apartment",
            "url":"https://www.immobilienscout24.at/expose/abc123",
            "address":{"postalCode":"1190","addressLocality":"Wien"},
            "numberOfRooms":2,
            "floorSize":{"value":50.62}
          }
        ]
      }</script>
      <span class="Costs-label-test">Monatliche Kosten</span><span class="Costs-price-test">1.569,22 €</span>
      <span class="Costs-label-test">Miete</span><span class="Costs-price-test">1.392,05 €</span>
      <span class="Costs-label-test">Betriebskosten</span><span class="Costs-price-test">177,17 €</span>
    `;
    mocks.fetchHtml.mockResolvedValue(html);
    mocks.fillUnknownMoneyFacts.mockResolvedValue({
      deposit: {
        amount: 2_784,
        confidence: "ESTIMATE",
        sourceText: "2 Bruttomonatsmieten Kaution",
      },
    });

    const listing = await immoScout24AtProvider.importFromUrl(
      "https://www.immobilienscout24.at/expose/abc123",
    );

    expect(listing.deposit).toEqual({
      amount: 2_784,
      confidence: "ESTIMATE",
      sourceText: "2 Bruttomonatsmieten Kaution",
    });
    // Structurally-parsed facts still come straight from the page, untouched.
    expect(listing.baseRent.amount).toBe(1392.05);
    expect(listing.operatingCosts.amount).toBe(177.17);
  });
});
