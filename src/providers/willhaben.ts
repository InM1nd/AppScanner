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
import { NonListingPageError, type ListingProvider } from "@/types/provider";
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
  matchesProviderHost,
} from "./shared/url-only-listing";
import { extractFetchedListingsFromEmail } from "./shared/email-alert-parsing";
import { fillUnknownMoneyFacts } from "./shared/ai-extract";
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

function advertisedMonthlyTotalFact(
  attrs: Record<string, string[]>,
): FinancialFact {
  const totalEncumbrance = first(attrs, "TOTAL_ENCUMBRANCE");
  if (totalEncumbrance)
    return moneyFact(totalEncumbrance, "TOTAL_ENCUMBRANCE (Gesamtbelastung)");
  const perMonth = first(attrs, "RENTAL_PRICE/PER_MONTH");
  if (perMonth) return moneyFact(perMonth, "RENTAL_PRICE/PER_MONTH");
  const price = first(attrs, "PRICE");
  if (price) return moneyFact(price, "PRICE");
  return unknownFact;
}

export function parseWillhabenListing(
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
    throw new NonListingPageError(
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

  const description = stripHtml(
    [
      first(attrs, "DESCRIPTION"),
      first(attrs, "GENERAL_TEXT_ADVERT/Ausstattung"),
      first(attrs, "GENERAL_TEXT_ADVERT/Lage"),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  const preferencesAndFreeArea = `${all(attrs, "ESTATE_PREFERENCE")} ${first(attrs, "FREE_AREA/FREE_AREA_TYPE") ?? ""}`;
  const heatingText = `${first(attrs, "HEATING") ?? ""} ${first(attrs, "GENERAL_TEXT_ADVERT/Ausstattung") ?? ""}`;
  const evidence =
    `${preferencesAndFreeArea} ${description ?? ""}`.toLowerCase();

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
    listingType:
      /wg-zimmer|wohngemeinschaft|shared apartment|zimmer in (?:einer )?wg/.test(
        `${title} ${evidence}`.toLowerCase(),
      )
        ? "SHARED_ROOM"
        : "RENTAL",
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
    advertisedMonthlyTotal: advertisedMonthlyTotalFact(attrs),
    // PER_MONTH_NET is a net monthly total on current Willhaben pages, not
    // a reliable cold/base-rent component. Keep base rent unknown.
    baseRent: unknownFact,
    operatingCosts: moneyFact(
      first(attrs, "RENTAL_PRICE/ADDITIONAL_COST_NET"),
      "Betriebskosten",
    ),
    deposit: moneyFact(first(attrs, "ADDITIONAL_COST/DEPOSIT"), "Kaution"),
    commission: /provisionsfrei|keine provision|abgeber zahlt/i.test(
      `${feeText ?? ""} ${description ?? ""}`,
    )
      ? exactFact(0, `Willhaben: ${feeText ?? "provisionsfrei"}`)
      : feeText
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
    hasSeparateBedroom: /kein(?:e|en)? separates? schlafzimmer/.test(evidence)
      ? "NO"
      : /\bschlafzimmer\b/.test(evidence)
        ? "YES"
        : "UNKNOWN",
    furnishedLevel: /unmöbliert/.test(evidence)
      ? "UNFURNISHED"
      : /teilmöbliert|teilweise möbliert/.test(evidence)
        ? "PARTLY_FURNISHED"
        : /möbliert/.test(evidence)
          ? "FURNISHED"
          : "UNKNOWN",
    kitchen: /keine küche/.test(evidence)
      ? "NONE"
      : /einbauküche/.test(evidence)
        ? "FITTED"
        : /\bküche\b|küchenzeile/.test(evidence)
          ? "BASIC"
          : "UNKNOWN",
    washingMachine: /waschmaschinenanschluss|waschmaschinenanschluß/.test(
      evidence,
    )
      ? "CONNECTION_ONLY"
      : /keine waschmaschine/.test(evidence)
        ? "NONE"
        : /\bwaschmaschine\b/.test(evidence)
          ? "MACHINE_INCLUDED"
          : "UNKNOWN",
    elevator:
      evidence.includes("fahrstuhl") || evidence.includes("aufzug")
        ? "YES"
        : "UNKNOWN",
    storage:
      evidence.includes("abstellraum") || evidence.includes("keller")
        ? "YES"
        : "UNKNOWN",
    balcony:
      evidence.includes("balkon") || evidence.includes("terrasse")
        ? "YES"
        : "UNKNOWN",
    airConditioning: /klimaanlage/.test(evidence) ? "YES" : "UNKNOWN",
    quietCourtyardSignal:
      /ruhig/.test(evidence) && /innenhof|hofseitig|hofseite/.test(evidence)
        ? "YES"
        : "UNKNOWN",
    newerOrRenovatedSignal: /erstbezug|neubau|frisch renoviert|saniert/.test(
      evidence,
    )
      ? "YES"
      : "UNKNOWN",
    description,
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
    if (!matchesProviderHost(url, DOMAINS)) {
      throw new Error(
        `URL host "${new URL(url).hostname}" is not a Willhaben URL.`,
      );
    }
    const html = await fetchHtml(url, DOMAINS);
    const parsed = parseWillhabenListing(html, url);
    const aiFacts = await fillUnknownMoneyFacts(parsed, parsed.description);
    return { ...parsed, ...aiFacts };
  },

  discoverListingUrls: discoverWillhabenListingUrls,

  async parseEmailAlert(rawEmail) {
    return extractFetchedListingsFromEmail(
      rawEmail,
      LISTING_URL_PATTERN,
      SOURCE_ID_PATTERN,
      async (url) => {
        const html = await fetchHtml(url, DOMAINS);
        return parseWillhabenListing(html, url);
      },
    );
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
