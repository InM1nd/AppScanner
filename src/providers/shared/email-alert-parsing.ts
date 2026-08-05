// Best-effort parser for saved-search alert emails the user forwards/pastes
// in. These are plain text/HTML the provider sent the user directly (an
// official channel, not scraping). We extract candidate listing URLs plus
// any nearby price/title text; everything stays at ESTIMATE/UNKNOWN
// confidence until the user reviews and saves.

import { buildUrlOnlyDraft } from "./url-only-listing";
import type { NormalizedListing } from "@/types/listing";
import { estimateFact } from "@/types/listing";
import { MONEY_FIELDS } from "@/server/listing-mapper";
import { extractMoneyFieldsWithAI, isAiExtractionEnabled } from "./ai-extract";

const PRICE_PATTERN = /(?:€|EUR)\s?([\d]{2,4}(?:[.,]\d{2})?)/;

function listingUrls(rawEmail: string, listingUrlPattern: RegExp): string[] {
  const urls = new Set<string>();
  const globalPattern = new RegExp(listingUrlPattern.source, "gi");
  for (const match of rawEmail.matchAll(globalPattern)) urls.add(match[0]);
  return [...urls];
}

export async function extractListingsFromEmail(
  rawEmail: string,
  listingUrlPattern: RegExp,
  sourceListingIdPattern: RegExp,
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  for (const url of listingUrls(rawEmail, listingUrlPattern)) {
    const draft = buildUrlOnlyDraft(url, sourceListingIdPattern);

    const urlIndex = rawEmail.indexOf(url);
    const windowStart = Math.max(0, urlIndex - 300);
    const windowText = rawEmail.slice(windowStart, urlIndex + 100);
    const priceMatch = windowText.match(PRICE_PATTERN);
    const heuristicBaseRent = priceMatch
      ? estimateFact(
          Number(priceMatch[1].replace(",", ".")),
          "Parsed from alert email text, unverified.",
        )
      : draft.baseRent;
    const aiFields = MONEY_FIELDS.filter(
      (field) =>
        field !== "baseRent" || heuristicBaseRent.confidence === "UNKNOWN",
    );
    const aiFacts = (await isAiExtractionEnabled())
      ? await extractMoneyFieldsWithAI(
          rawEmail.slice(Math.max(0, urlIndex - 2_000), urlIndex + 1_000),
          aiFields,
        )
      : {};

    results.push({
      ...draft,
      ...aiFacts,
      importMethod: "EMAIL_ALERT",
      baseRent:
        heuristicBaseRent.confidence !== "UNKNOWN"
          ? heuristicBaseRent
          : (aiFacts.baseRent ?? heuristicBaseRent),
      description:
        "Parsed from a pasted saved-search alert email. Please open the listing and verify all fields before saving.",
    });
  }

  return results;
}

export async function extractFetchedListingsFromEmail(
  rawEmail: string,
  listingUrlPattern: RegExp,
  sourceListingIdPattern: RegExp,
  fetchListing: (url: string) => Promise<NormalizedListing>,
): Promise<NormalizedListing[]> {
  const results: NormalizedListing[] = [];
  for (const url of listingUrls(rawEmail, listingUrlPattern)) {
    try {
      results.push({
        ...(await fetchListing(url)),
        importMethod: "EMAIL_ALERT",
      });
    } catch {
      results.push({
        ...buildUrlOnlyDraft(url, sourceListingIdPattern),
        importMethod: "EMAIL_ALERT",
      });
    }
  }
  return results;
}
