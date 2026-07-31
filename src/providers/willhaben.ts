// Real Willhaben adapter. willhaben.at's robots.txt carries a blanket
// "no bots" notice (not just path-specific Disallow rules) — fetching this
// site was a deliberate, explicit call by the project owner for personal use
// (see AGENTS.md and the conversation that authorized it), not a default.
//
// Detail pages embed a Next.js `__NEXT_DATA__` JSON blob with a clean
// attribute list (`advertDetails.attributes.attribute[]`, key/value pairs
// like "RENTAL_PRICE/PER_MONTH_NET"). That's the primary data source here —
// far more reliable than scraping rendered HTML/CSS selectors.

import * as cheerio from "cheerio";
import type { ListingProvider } from "@/types/provider";
import {
  blankNormalizedListing,
  exactFact,
  unknownFact,
  type FinancialFact,
  type NormalizedListing,
} from "@/types/listing";
import { fetchHtml } from "./shared/fetch-html";
import {
  districtFromPostalCode,
  buildUrlOnlyDraft,
} from "./shared/url-only-listing";
import {
  parseEuroAmount,
  stripHtml,
  detectHeatingType,
  detectContractType,
} from "./shared/text-signals";

const DOMAINS = ["willhaben.at", "www.willhaben.at"];
const SOURCE_ID_PATTERN = /-(\d{6,12})(?:[/?#]|$)/;
const LISTING_URL_PATTERN =
  /https?:\/\/(?:www\.)?willhaben\.at\/iad\/[^\s"<>]+/i;

function hostMatches(url: string): boolean {
  const host = new URL(url).hostname;
  return DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

function attributesToMap(
  advertDetails: Record<string, unknown>,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const list = (
    advertDetails?.attributes as
      { attribute?: { name?: string; values?: unknown[] }[] } | undefined
  )?.attribute;
  for (const attr of list ?? []) {
    if (attr?.name && Array.isArray(attr.values) && attr.values.length > 0) {
      map[attr.name] = attr.values.map(String);
    }
  }
  return map;
}

function first(map: Record<string, string[]>, key: string): string | undefined {
  return map[key]?.[0];
}

function all(map: Record<string, string[]>, key: string): string {
  return (map[key] ?? []).join(", ");
}

function parseGermanDate(value: string | undefined): Date | null {
  const m = value?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function moneyFact(
  raw: string | undefined,
  sourceLabel: string,
): FinancialFact {
  const amount = parseEuroAmount(raw);
  return amount !== null
    ? exactFact(amount, `Willhaben: ${sourceLabel} (${raw})`)
    : unknownFact;
}

// Not every listing has the net/cold-rent breakdown (RENTAL_PRICE/PER_MONTH_NET)
// — Genossenschaft and shared-room listings especially often only carry the
// generic RENTAL_PRICE/PER_MONTH or PRICE attribute instead. Fall through in
// order of specificity rather than leaving baseRent UNKNOWN when a real
// figure is right there.
function rentFact(attrs: Record<string, string[]>): FinancialFact {
  const net = first(attrs, "RENTAL_PRICE/PER_MONTH_NET");
  if (net) return moneyFact(net, "Nettomiete");
  const perMonth = first(attrs, "RENTAL_PRICE/PER_MONTH");
  if (perMonth)
    return moneyFact(
      perMonth,
      "RENTAL_PRICE/PER_MONTH (no net/gross split given)",
    );
  const price = first(attrs, "PRICE");
  if (price) return moneyFact(price, "PRICE (no rent breakdown given)");
  return unknownFact;
}

function parseWillhabenListing(
  html: string,
  fallbackUrl: string,
): NormalizedListing {
  const $ = cheerio.load(html);
  const raw = $("script#__NEXT_DATA__").contents().text();
  if (!raw) {
    throw new Error(
      "Could not find listing data on the page (Willhaben may have changed its page structure).",
    );
  }
  const nextData = JSON.parse(raw);
  const advertDetails = nextData?.props?.pageProps?.advertDetails;
  if (!advertDetails) {
    throw new Error(
      "This URL is not a Willhaben listing detail page (it may be expired, or a search-results link). Open the listing itself and copy its URL.",
    );
  }

  const attrs = attributesToMap(advertDetails);
  const addr = advertDetails.advertAddressDetails ?? {};
  const addressLines: string[] = addr.addressLines?.value ?? [];
  const postalCode: string | null = addr.postCode ?? null;

  const images: string[] = (advertDetails.advertImageList?.advertImage ?? [])
    .map((img: { mainImageUrl?: unknown }) => img?.mainImageUrl)
    .filter((url: unknown): url is string => typeof url === "string");

  const [lat, lng] = all(attrs, "COORDINATES")
    .split(",")
    .map((v) => Number(v.trim()));

  const preferencesAndFreeArea =
    `${all(attrs, "ESTATE_PREFERENCE")} ${first(attrs, "FREE_AREA/FREE_AREA_TYPE") ?? ""}`.toLowerCase();
  const heatingText = `${first(attrs, "HEATING") ?? ""} ${first(attrs, "GENERAL_TEXT_ADVERT/Ausstattung") ?? ""}`;

  const canonicalUrl: string =
    advertDetails.seoMetaData?.canonicalUrl || fallbackUrl;
  const title = (advertDetails.seoMetaData?.title ?? "")
    .replace(/\s*-\s*willhaben\s*$/i, "")
    .trim();

  const feeText = first(attrs, "ADDITIONAL_COST/FEE");

  return {
    ...blankNormalizedListing,
    title: title || "Imported listing (needs review)",
    sourceListingId: advertDetails.id != null ? String(advertDetails.id) : null,
    canonicalUrl,
    importMethod: "URL_METADATA",
    listingType: "RENTAL",
    address: addressLines.join(", ") || null,
    postalCode,
    district: districtFromPostalCode(postalCode),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    rooms: first(attrs, "NO_OF_ROOMS")
      ? Number(first(attrs, "NO_OF_ROOMS")!.replace(",", "."))
      : null,
    squareMeters: first(attrs, "ESTATE_SIZE")
      ? Number(first(attrs, "ESTATE_SIZE")!.replace(",", "."))
      : null,
    baseRent: rentFact(attrs),
    operatingCosts: moneyFact(
      first(attrs, "RENTAL_PRICE/ADDITIONAL_COST_NET"),
      "Betriebskosten",
    ),
    deposit: moneyFact(first(attrs, "ADDITIONAL_COST/DEPOSIT"), "Kaution"),
    commission: feeText
      ? {
          amount: null,
          confidence: "UNKNOWN",
          sourceText: `Willhaben: ${feeText}`,
        }
      : unknownFact,
    availabilityDate: parseGermanDate(first(attrs, "AVAILABLE_DATE")),
    contractType: detectContractType(first(attrs, "DURATION/HASTERMLIMIT")),
    energyRating: first(attrs, "ENERGY_HWB_CLASS") ?? null,
    heatingType: detectHeatingType(heatingText),
    elevator: preferencesAndFreeArea.includes("fahrstuhl") ? "YES" : "UNKNOWN",
    storage:
      preferencesAndFreeArea.includes("abstellraum") ||
      preferencesAndFreeArea.includes("keller")
        ? "YES"
        : "UNKNOWN",
    balcony:
      preferencesAndFreeArea.includes("balkon") ||
      preferencesAndFreeArea.includes("terrasse")
        ? "YES"
        : "UNKNOWN",
    description: stripHtml(
      [first(attrs, "DESCRIPTION"), first(attrs, "GENERAL_TEXT_ADVERT/Lage")]
        .filter(Boolean)
        .join("\n\n"),
    ),
    photos: images,
  };
}

// Willhaben's rendered pagination is a client-side widget with no real
// hrefs, but the public search page itself accepts a plain ?page=N query
// param (confirmed empirically) and its __NEXT_DATA__ tells us exactly how
// many pages exist — no need to touch their internal ad-search.willhaben.at
// REST API. Default sort ("published.descending" / Aktualität) is
// newest-first, which the crawler relies on for its early-stop heuristic —
// a saved search URL with a different sort= param breaks that assumption.
const MAX_SEARCH_PAGES = 20;

async function* discoverWillhabenListingUrls(
  searchUrl: string,
): AsyncGenerator<string> {
  const base = new URL(searchUrl);
  for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
    base.searchParams.set("page", String(page));
    const html = await fetchHtml(base.toString(), DOMAINS);
    const $ = cheerio.load(html);
    const raw = $("script#__NEXT_DATA__").contents().text();
    if (!raw) return;
    const nextData = JSON.parse(raw);
    const searchResult = nextData?.props?.pageProps?.searchResult;
    if (!searchResult || searchResult.pageRequested !== page) return; // clamped past the last page

    const items = searchResult.advertSummaryList?.advertSummary ?? [];
    if (items.length === 0) return;

    for (const item of items) {
      const seoUrlAttr = (item.attributes?.attribute ?? []).find(
        (a: { name?: string }) => a.name === "SEO_URL",
      );
      const seoUrl = seoUrlAttr?.values?.[0];
      if (typeof seoUrl === "string")
        yield `https://www.willhaben.at/iad/${seoUrl}`;
    }

    const rowsSeen = page * (searchResult.rowsReturned || items.length);
    if (rowsSeen >= (searchResult.rowsFound ?? rowsSeen)) return;
  }
}

export const willhabenProvider: ListingProvider = {
  name: "Willhaben",

  getSearchUrls() {
    return [
      {
        label: "Willhaben — Wohnungen mieten in Wien",
        url: "https://www.willhaben.at/iad/immobilien/mietwohnungen/wien",
        description:
          "Open this, apply your filters, then paste any listing URL here to import it automatically.",
      },
    ];
  },

  async importFromUrl(url) {
    if (!hostMatches(url)) {
      throw new Error(
        `URL host "${new URL(url).hostname}" is not a Willhaben URL.`,
      );
    }
    const html = await fetchHtml(url, DOMAINS);
    return parseWillhabenListing(html, url);
  },

  discoverListingUrls: discoverWillhabenListingUrls,

  async parseEmailAlert(rawEmail) {
    const urls = new Set<string>();
    for (const m of rawEmail.matchAll(
      new RegExp(LISTING_URL_PATTERN.source, "gi"),
    ))
      urls.add(m[0]);

    const results: NormalizedListing[] = [];
    for (const url of urls) {
      try {
        const html = await fetchHtml(url, DOMAINS);
        results.push({
          ...parseWillhabenListing(html, url),
          importMethod: "EMAIL_ALERT",
        });
      } catch {
        results.push({
          ...buildUrlOnlyDraft(url, SOURCE_ID_PATTERN),
          importMethod: "EMAIL_ALERT",
        });
      }
    }
    return results;
  },

  getSetupInstructions() {
    return [
      {
        step: 1,
        title: "Open Willhaben rentals for Vienna",
        description: "Go to willhaben.at → Immobilien → Mieten → Wien.",
      },
      {
        step: 2,
        title: "Apply your filters",
        description:
          "Set districts 14/15/16 (and 6/7/10/11/12 as a second search), 2 Zimmer, price up to €1100, and 'Provisionsfrei' if desired.",
      },
      {
        step: 3,
        title: "Paste any listing URL",
        description:
          "Use Import → Paste URL for a specific listing — it's fetched and parsed automatically.",
      },
      {
        step: 4,
        title: "Or paste alert emails",
        description:
          "Save the search, enable email alerts, then use Import → Paste alert email to import every link in one go.",
      },
    ];
  },
};
