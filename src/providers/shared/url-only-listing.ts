// Shared helper for the URL-only Vienna real-estate site adapters (Immowelt,
// derStandard, FindMyHome — Willhaben and ImmoScout24.at moved to real fetch,
// see willhaben.ts / immoscout24-at.ts). `importFromUrl` here never makes an
// HTTP request — it only parses the URL string itself (path segments often
// encode a listing id and sometimes a district/zip) and hands back a
// mostly-blank draft for manual correction. This is what
// importMethod = "URL_METADATA" actually means for these three providers: the
// canonical URL was recognized and an id was extracted, nothing more.

import {
  blankNormalizedListing,
  type NormalizedListing,
} from "@/types/listing";

// Vienna postal codes are 1010-1230; look for a bare 4-digit token in the URL.
function extractPostalCode(url: string): string | null {
  const match = url.match(/\b(1[0-2]\d0)\b/);
  return match ? match[1] : null;
}

export function matchesProviderHost(url: string, domains: readonly string[]) {
  const host = new URL(url).hostname.toLowerCase();
  return domains.some((domain) => {
    const normalized = domain.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

export function districtFromPostalCode(
  postalCode: string | null,
): number | null {
  if (!postalCode) return null;
  const n = Number(postalCode.slice(1, 3));
  return Number.isFinite(n) && n >= 1 && n <= 23 ? n : null;
}

export function buildUrlOnlyDraft(
  rawUrl: string,
  sourceListingIdPattern: RegExp,
): NormalizedListing {
  new URL(rawUrl);
  const idMatch = rawUrl.match(sourceListingIdPattern);
  const sourceListingId = idMatch?.[1] ?? null;

  const postalCode = extractPostalCode(rawUrl);

  return {
    ...blankNormalizedListing,
    title: "Imported listing (needs review)",
    canonicalUrl: rawUrl,
    sourceListingId,
    importMethod: "URL_METADATA",
    postalCode,
    district: districtFromPostalCode(postalCode),
    description:
      "Only the URL was parsed for this listing (no automated fetching is used for this provider). Please open the link and fill in the remaining fields manually.",
  };
}
