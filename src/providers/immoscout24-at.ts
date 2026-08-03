// Real ImmoScout24.at adapter. Its robots.txt only blocks two named
// aggressive bots (MJ12bot, AhrefsBot) from /expose — no blanket prohibition —
// so real fetching here is on firmer ground than Willhaben's, though both
// were authorized together (see AGENTS.md).
//
// Detail pages carry basic schema.org JSON-LD plus a richer Apollo state with
// the full description, costs, availability and structured property facts.
// The rendered label/value pairs remain as a fallback for older pages.

import * as cheerio from "cheerio";
import { NonListingPageError, type ListingProvider } from "@/types/provider";
import {
  blankNormalizedListing,
  exactFact,
  estimateFact,
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
  detectAmenitySignal,
} from "./shared/text-signals";

const DOMAINS = ["immobilienscout24.at", "www.immobilienscout24.at"];
const SOURCE_ID_PATTERN = /expose\/([0-9a-f]{6,})/i;
const LISTING_URL_PATTERN =
  /https?:\/\/(?:www\.)?immobilienscout24\.at\/expose\/[0-9a-f]+[^\s"<>]*/i;

function hostMatches(url: string): boolean {
  const host = new URL(url).hostname;
  return DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

type JsonLdNode = Record<string, unknown>;
type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function extractApolloExpose(html: string): JsonRecord | null {
  const marker = "window.__APOLLO_STATE__=";
  const $ = cheerio.load(html);
  for (const script of $("script").toArray()) {
    const raw = $(script).contents().text();
    const start = raw.indexOf(marker);
    if (start === -1) continue;
    const serialized = raw
      .slice(start + marker.length)
      .split(/\r?\n/, 1)[0]
      .replace(/;$/, "");
    try {
      const state = asRecord(JSON.parse(serialized));
      if (!state) return null;
      return (
        Object.values(state)
          .map(asRecord)
          .find((value) => value?.__typename === "Expose") ?? null
      );
    } catch {
      return null;
    }
  }
  return null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function apolloCostMap(expose: JsonRecord | null): Map<string, string> {
  const map = new Map<string, string>();
  const costs = asRecord(expose?.costs);
  for (const group of [costs?.running, costs?.oneTime]) {
    if (!Array.isArray(group)) continue;
    for (const raw of group) {
      const row = asRecord(raw);
      const label = textValue(row?.label);
      const price = textValue(row?.price);
      if (label && price && !map.has(label)) map.set(label, price);
    }
  }
  return map;
}

function parseGermanDate(value: unknown): Date | null {
  const match = textValue(value)?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  const date = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseContractFee(description: string | null): FinancialFact {
  const raw = description?.match(
    /(?:abwicklungshonorar|vertragserrichtungsgeb(?:ü|ue)hr)[\s\S]{0,60}?(?:EUR|€)\s*([\d.]+(?:,\d{1,2})?)/i,
  )?.[1];
  const amount = parseEuroAmount(raw);
  return amount === null
    ? unknownFact
    : exactFact(amount, `IS24 description: contract fee (${raw})`);
}

function extractJsonLdGraph(html: string): JsonLdNode[] {
  const $ = cheerio.load(html);
  const raw = $('script[type="application/ld+json"]').first().contents().text();
  if (!raw)
    throw new Error(
      "Could not find listing data on the page (ImmoScout24 may have changed its page structure).",
    );
  const parsed = JSON.parse(raw);
  const graph = parsed["@graph"];
  return Array.isArray(graph) ? graph : [parsed];
}

// Their build-hashed classnames wrap a label span and a (nested) value span,
// e.g. <span class="Costs-label-Dp_ ...">Betriebskosten</span><span
// class="Costs-price-row-pau ..."><span class="Costs-price-uNE ...">386,03
// €</span></span> — match on the stable "Costs-label-"/"Costs-price-" prefix
// and let the lazy .*? skip past the outer wrapper span to the inner text.
function extractLabelValuePairs(
  html: string,
  labelPrefix: string,
  valuePrefix: string,
): Map<string, string> {
  const map = new Map<string, string>();
  const re = new RegExp(
    `${labelPrefix}\\w+[^"]*">([^<]+)</span>.*?${valuePrefix}\\w+[^"]*">([^<]+)</span>`,
    "g",
  );
  for (const m of html.matchAll(re)) map.set(m[1].trim(), m[2].trim());
  return map;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseDeposit(
  raw: string | undefined,
  grossMonthlyRent: number | null,
): FinancialFact {
  if (!raw) return unknownFact;
  if (!/monatsmiete/i.test(raw)) {
    const direct = parseEuroAmount(raw);
    return direct !== null
      ? exactFact(direct, `IS24 Kaution: ${raw}`)
      : {
          amount: null,
          confidence: "UNKNOWN",
          sourceText: `IS24 Kaution: ${raw}`,
        };
  }
  const formula = raw.match(/(\d+(?:[.,]\d+)?)\s*Bruttomonatsmieten?/i);
  if (formula && grossMonthlyRent !== null) {
    const multiplier = Number(formula[1].replace(",", "."));
    return estimateFact(
      round2(multiplier * grossMonthlyRent),
      `IS24 Kaution: ${raw} × Gesamtmiete (€${grossMonthlyRent})`,
    );
  }
  return {
    amount: null,
    confidence: "UNKNOWN",
    sourceText: `IS24 Kaution: ${raw}`,
  };
}

export function parseIS24Listing(
  html: string,
  fallbackUrl: string,
): NormalizedListing {
  const graph = extractJsonLdGraph(html);
  const product = graph.find((n) => n["@type"] === "Product");
  const listing = graph.find((n) => n["@type"] === "RealEstateListing");
  const expose = extractApolloExpose(html);

  if (!listing) {
    throw new NonListingPageError(
      "This URL is a multi-unit project page, not a single listing. Open a specific unit's page and copy its URL instead.",
    );
  }

  const apolloCosts = apolloCostMap(expose);
  const costs =
    apolloCosts.size > 0
      ? apolloCosts
      : extractLabelValuePairs(html, "Costs-label-", "Costs-price-");
  const keyfacts = extractLabelValuePairs(html, "Label-label-", "Label-value-");

  const offers = product?.offers as Record<string, unknown> | undefined;
  const priceInformation = asRecord(expose?.priceInformation);
  const grossPrice =
    numberValue(priceInformation?.primaryPrice) ?? numberValue(offers?.price);
  const grossRaw = costs.get("Gesamtmiete") ?? costs.get("Monatliche Kosten");
  const grossTotal = grossPrice ?? parseEuroAmount(grossRaw);

  const address = listing.address as Record<string, unknown> | undefined;
  const postalCode =
    typeof address?.postalCode === "string" ? address.postalCode : null;
  const addressParts = [
    address?.streetAddress,
    address?.addressLocality,
  ].filter((v): v is string => typeof v === "string");

  const images: string[] = Array.isArray(product?.image)
    ? (product!.image as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : typeof listing.image === "string"
      ? [listing.image]
      : [];

  const description =
    textValue(asRecord(expose?.description)?.descriptionNote) ??
    textValue(product?.description);
  const combinedText = `${description ?? ""} ${listing.name ?? ""}`;
  const evidence = combinedText.toLowerCase();

  const idMatch = (
    typeof listing.url === "string" ? listing.url : fallbackUrl
  ).match(SOURCE_ID_PATTERN);

  const rooms =
    typeof listing.numberOfRooms === "number" ? listing.numberOfRooms : null;
  const floorSize = listing.floorSize as { value?: unknown } | undefined;
  const squareMeters =
    typeof floorSize?.value === "number" ? floorSize.value : null;

  const netRent = parseEuroAmount(costs.get("Miete"));
  const operating = parseEuroAmount(costs.get("Betriebskosten"));
  const heating = parseEuroAmount(costs.get("Heizkosten Netto"));
  const object = asRecord(expose?.object);
  const area = asRecord(expose?.area);
  const fitting = asRecord(expose?.fitting);
  const condition = asRecord(expose?.condition);
  const firingTypes = Array.isArray(condition?.firingTypes)
    ? condition.firingTypes
        .map(asRecord)
        .flatMap((item) => [textValue(item?.label), textValue(item?.value)])
        .filter((value): value is string => value !== null)
        .join(" ")
    : "";
  const energyRating = textValue(
    asRecord(asRecord(condition?.energyCertification)?.heatingDemandClass)
      ?.label,
  );
  const availabilityDate = parseGermanDate(object?.availableFrom);
  const hasFixedRentalPeriod =
    textValue(object?.rentalPeriod) !== null &&
    textValue(object?.rentalPeriodType) !== null;
  const bedroomCount = numberValue(area?.numberOfBedrooms);
  const balconyCount = numberValue(area?.numberOfBalconies);
  const cellarArea = numberValue(area?.cellarArea);
  const lift = Array.isArray(fitting?.lift) ? fitting.lift : [];
  const commission =
    priceInformation?.hasCommission === false
      ? exactFact(0, "IS24 price information: free of commission")
      : unknownFact;

  return {
    ...blankNormalizedListing,
    title:
      (typeof listing.name === "string" && listing.name) ||
      "Imported listing (needs review)",
    sourceListingId: idMatch?.[1] ?? null,
    canonicalUrl:
      (typeof listing.url === "string" && listing.url) || fallbackUrl,
    importMethod: "URL_METADATA",
    listingType: "RENTAL",
    address: addressParts.join(", ") || null,
    postalCode,
    district: districtFromPostalCode(postalCode),
    rooms,
    squareMeters,
    advertisedMonthlyTotal:
      grossTotal !== null
        ? exactFact(
            grossTotal,
            grossRaw
              ? `IS24 cost breakdown: advertised total (${grossRaw})`
              : `IS24 JSON-LD Offer price (${grossPrice})`,
          )
        : unknownFact,
    baseRent:
      netRent !== null
        ? exactFact(
            netRent,
            `IS24 cost breakdown: Miete (${costs.get("Miete")})`,
          )
        : unknownFact,
    operatingCosts:
      operating !== null
        ? exactFact(
            operating,
            `IS24 cost breakdown: Betriebskosten (${costs.get("Betriebskosten")})`,
          )
        : unknownFact,
    heatingCost:
      heating !== null
        ? exactFact(
            heating,
            `IS24 cost breakdown: Heizkosten Netto (${costs.get("Heizkosten Netto")})`,
          )
        : unknownFact,
    deposit: parseDeposit(
      costs.get("Kaution") ?? keyfacts.get("Kaution"),
      grossTotal,
    ),
    commission,
    contractFee: parseContractFee(description),
    availabilityDate,
    contractType: hasFixedRentalPeriod
      ? "FIXED_TERM"
      : detectContractType(keyfacts.get("Befristung")),
    hasSeparateBedroom:
      bedroomCount !== null && bedroomCount > 0
        ? "YES"
        : /kein(?:e|en)? (?:separates? )?schlafzimmer/.test(evidence)
          ? "NO"
          : /\bschlafzimmer\b/.test(evidence)
            ? "YES"
            : "UNKNOWN",
    kitchen: /keine k(?:ü|ue)che/.test(evidence)
      ? "NONE"
      : /einbauk(?:ü|ue)che/.test(evidence)
        ? "FITTED"
        : /\bk(?:ü|ue)che\b|k(?:ü|ue)chenzeile|markenk(?:ü|ue)che/.test(
              evidence,
            )
          ? "BASIC"
          : "UNKNOWN",
    washingMachine: /waschmaschinenanschluss/.test(evidence)
      ? "CONNECTION_ONLY"
      : /keine waschmaschine/.test(evidence)
        ? "NONE"
        : /\bwaschmaschine\b/.test(evidence)
          ? "MACHINE_INCLUDED"
          : "UNKNOWN",
    parkingAvailability:
      /(?:garage|garagenplatz|stellplatz)[\s\S]{0,40}(?:aufpreis|monatlich|extra)/.test(
        evidence,
      )
        ? "AVAILABLE_EXTRA_COST"
        : "UNKNOWN",
    heatingType: /\bgas\b/i.test(firingTypes)
      ? "GAS"
      : detectHeatingType(`${combinedText} ${firingTypes}`),
    energyRating,
    elevator:
      lift.length > 0
        ? "YES"
        : detectAmenitySignal(combinedText, ["lift", "aufzug"]),
    storage:
      cellarArea !== null && cellarArea > 0
        ? "YES"
        : detectAmenitySignal(combinedText, ["keller", "abstellraum"]),
    balcony:
      balconyCount !== null && balconyCount > 0
        ? "YES"
        : detectAmenitySignal(combinedText, ["balkon", "terrasse"]),
    airConditioning: detectAmenitySignal(combinedText, ["klimaanlage"]),
    quietCourtyardSignal:
      /ruhig/.test(evidence) && /innenhof|hofseitig|hofseite/.test(evidence)
        ? "YES"
        : "UNKNOWN",
    newerOrRenovatedSignal: /erstbezug|neubau|frisch renoviert|saniert/.test(
      evidence,
    )
      ? "YES"
      : "UNKNOWN",
    description: stripHtml(description),
    photos: images,
  };
}

// IS24 paginates via a path segment (/seite-2, /seite-3, ...), not a query
// param, and how it combines with whatever filter segments a saved search
// URL carries isn't worth reverse-engineering — the page itself renders a
// `rel="next"` link with the correct URL already built, so we just follow
// it. Unlike Willhaben, IS24's default sort order isn't confirmed
// newest-first, so the crawler must not rely on a duplicate-streak
// early-stop here — see NEWEST_FIRST_PROVIDERS in server/crawler.ts.
const MAX_SEARCH_PAGES = 20;
const NEXT_LINK_PATTERN = /<a[^>]*\shref="([^"]+)"[^>]*\srel="next"/;

async function* discoverIS24ListingUrls(
  searchUrl: string,
): AsyncGenerator<string> {
  let pageUrl: string | null = searchUrl;
  for (let page = 0; page < MAX_SEARCH_PAGES && pageUrl; page++) {
    const html: string = await fetchHtml(pageUrl, DOMAINS, true);
    const ids = new Set<string>();
    for (const m of html.matchAll(/href="\/expose\/([0-9a-f]+)"/gi))
      ids.add(m[1]);
    for (const id of ids) yield `https://www.immobilienscout24.at/expose/${id}`;
    if (ids.size === 0) return;

    const next = html.match(NEXT_LINK_PATTERN);
    // The href comes straight out of raw HTML text — "&amp;" needs decoding
    // back to "&" before URL() parses the query string, or every param past
    // the first gets mangled into the previous one's value.
    pageUrl = next
      ? new URL(next[1].replace(/&amp;/g, "&"), pageUrl).toString()
      : null;
  }
}

export const immoScout24AtProvider: ListingProvider = {
  name: "ImmoScout24 Austria",

  getSearchUrls() {
    return [
      {
        label: "ImmoScout24 AT — Wohnungen mieten in Wien",
        url: "https://www.immobilienscout24.at/regional/wien/wohnung-mieten",
        description:
          "Open this, apply your filters, then paste any listing URL here to import it automatically.",
      },
    ];
  },

  async importFromUrl(url) {
    if (!hostMatches(url)) {
      throw new Error(
        `URL host "${new URL(url).hostname}" is not an ImmoScout24.at URL.`,
      );
    }
    const html = await fetchHtml(url, DOMAINS, true);
    return parseIS24Listing(html, url);
  },

  discoverListingUrls: discoverIS24ListingUrls,

  async parseEmailAlert(rawEmail) {
    const urls = new Set<string>();
    for (const m of rawEmail.matchAll(
      new RegExp(LISTING_URL_PATTERN.source, "gi"),
    ))
      urls.add(m[0]);

    const results: NormalizedListing[] = [];
    for (const url of urls) {
      try {
        const html = await fetchHtml(url, DOMAINS, true);
        results.push({
          ...parseIS24Listing(html, url),
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
        title: "Open ImmoScout24 rentals for Vienna",
        description: "Go to immobilienscout24.at → Mieten → Wien.",
      },
      {
        step: 2,
        title: "Apply your filters",
        description:
          "Districts, 2 rooms, price up to €1100, and any amenity filters you care about.",
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
