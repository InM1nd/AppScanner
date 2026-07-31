// Fallback for sites without a dedicated adapter. It uses the shared safe
// fetch/robots/rate-limit path and reads only public Open Graph / JSON-LD
// metadata — no login walls, CAPTCHA bypass, pagination, or crawling.

import type { ListingProvider } from "@/types/provider";
import { blankNormalizedListing, estimateFact } from "@/types/listing";
import { fetchHtml } from "./shared/fetch-html";
import { extractMetadataFromHtml } from "./shared/html-metadata";

export const genericUrlProvider: ListingProvider = {
  name: "Generic URL importer",

  getSearchUrls() {
    return [];
  },

  async importFromUrl(url) {
    const html = await fetchHtml(url);
    const meta = extractMetadataFromHtml(html);

    return {
      ...blankNormalizedListing,
      title: meta.title ?? "Imported listing (needs review)",
      canonicalUrl: url,
      importMethod: "URL_METADATA",
      address: meta.address,
      description: meta.description,
      photos: meta.images,
      baseRent:
        meta.price !== null
          ? estimateFact(
              meta.price,
              "Extracted from page Open Graph/JSON-LD metadata, unverified.",
            )
          : blankNormalizedListing.baseRent,
    };
  },

  getSetupInstructions() {
    return [
      {
        step: 1,
        title: "Paste any public listing URL",
        description:
          "Works for sites without a dedicated adapter. Only public Open Graph / JSON-LD metadata is read — no login, no CAPTCHA bypass.",
      },
      {
        step: 2,
        title: "Review before saving",
        description:
          "Parsed fields are shown for correction. Anything not explicitly present on the page stays marked unknown — nothing is guessed.",
      },
    ];
  },
};
