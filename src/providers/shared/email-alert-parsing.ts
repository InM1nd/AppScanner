// Best-effort parser for saved-search alert emails the user forwards/pastes
// in. These are plain text/HTML the provider sent the user directly (an
// official channel, not scraping). We extract candidate listing URLs plus
// any nearby price/title text; everything stays at ESTIMATE/UNKNOWN
// confidence until the user reviews and saves.

import { buildUrlOnlyDraft } from "./url-only-listing";
import type { NormalizedListing } from "@/types/listing";
import { estimateFact } from "@/types/listing";

const PRICE_PATTERN = /(?:€|EUR)\s?([\d]{2,4}(?:[.,]\d{2})?)/;

export function extractListingsFromEmail(
  rawEmail: string,
  listingUrlPattern: RegExp,
  sourceListingIdPattern: RegExp,
): NormalizedListing[] {
  const urls = new Set<string>();
  const globalPattern = new RegExp(listingUrlPattern.source, "gi");
  for (const match of rawEmail.matchAll(globalPattern)) {
    urls.add(match[0]);
  }

  const results: NormalizedListing[] = [];
  for (const url of urls) {
    const draft = buildUrlOnlyDraft(url, sourceListingIdPattern);

    const urlIndex = rawEmail.indexOf(url);
    const windowStart = Math.max(0, urlIndex - 300);
    const windowText = rawEmail.slice(windowStart, urlIndex + 100);
    const priceMatch = windowText.match(PRICE_PATTERN);

    results.push({
      ...draft,
      importMethod: "EMAIL_ALERT",
      baseRent: priceMatch
        ? estimateFact(
            Number(priceMatch[1].replace(",", ".")),
            "Parsed from alert email text, unverified.",
          )
        : draft.baseRent,
      description:
        "Parsed from a pasted saved-search alert email. Please open the listing and verify all fields before saving.",
    });
  }

  return results;
}
