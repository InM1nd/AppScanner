import { describe, expect, it } from "vitest";
import { NonListingPageError } from "@/types/provider";
import { parseIS24Listing } from "./immoscout24-at";

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

  it("V23 classifies a project page as a non-listing skip", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Project"}</script>`;
    expect(() =>
      parseIS24Listing(html, "https://www.immobilienscout24.at/expose/project"),
    ).toThrow(NonListingPageError);
  });
});
