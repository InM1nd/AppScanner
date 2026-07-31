// Real Lystio adapter. lystio.at's robots.txt is permissive ("Allow: /",
// only tenant/landlord dashboard paths disallowed) — no blanket prohibition,
// no bot-challenge encountered on detail pages (unlike Immowelt's DataDome
// wall). Detail pages are plain server-rendered HTML (fetchHtml is enough),
// but search results are entirely client-rendered with pagination as a real
// button — no query param, no link, no discoverable internal API worth
// reverse-engineering — so discoverListingUrls launches a real headless
// browser (Playwright) just for that one step; see the comment above it.
//
// Detail pages carry schema.org JSON-LD (`@graph`: WebPage, RealEstateListing
// -> about: Apartment/Product) for rooms/area/address/images/price, but the
// cost breakdown (Rent / Operating costs / Security Deposit) only lives in
// rendered HTML inside a `<section id="price-breakdown">` — scoping the
// label/value regex to that section (rather than the whole page) avoids
// mismatching unrelated same-styled text elsewhere (e.g. the broker's name).
//
// Lystio's English-locale (/en/) figures use ENGLISH number formatting
// (comma = thousands separator, dot = decimal) — the OPPOSITE convention
// from Willhaben/IS24's Austrian/German formatting. Do not reuse
// shared/text-signals.ts's parseEuroAmount here.

import * as cheerio from "cheerio";
import type { ListingProvider } from "@/types/provider";
import {
  blankNormalizedListing,
  exactFact,
  unknownFact,
  type NormalizedListing,
} from "@/types/listing";
import { fetchHtml, BROWSER_USER_AGENT } from "./shared/fetch-html";
import { isFetchAllowedByRobots } from "./shared/robots";
import { waitForRateLimit } from "./shared/rate-limit";
import { assertSafePublicUrl } from "./shared/safe-fetch";
import {
  districtFromPostalCode,
  buildUrlOnlyDraft,
} from "./shared/url-only-listing";
import { stripHtml, detectAmenitySignal } from "./shared/text-signals";

const DOMAINS = ["lystio.at", "www.lystio.at"];
const SOURCE_ID_PATTERN = /\/(\d+)(?:[/?#]|$)/;
const LISTING_URL_PATTERN =
  /https?:\/\/(?:www\.)?lystio\.at\/[a-z]{2}\/rent\/apartment\/[^\s"<>]+/i;

function hostMatches(url: string): boolean {
  const host = new URL(url).hostname;
  return DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

// "2,849€" -> 2849 (comma is a thousands separator here, not a decimal mark).
function parseEnglishEuroAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

type JsonLdNode = Record<string, unknown>;

function extractJsonLdGraph(html: string): JsonLdNode[] {
  const $ = cheerio.load(html);
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).contents().text();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed["@graph"])) return parsed["@graph"];
    } catch {
      // try the next script block
    }
  }
  return [];
}

function extractPriceBreakdown(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const start = html.indexOf('id="price-breakdown"');
  if (start === -1) return map;
  const end = html.indexOf("</section>", start);
  const section = html.slice(start, end === -1 ? undefined : end);
  const re =
    /ds-body-sm-regular ds-text-medium[^"]*">([^<]+)<\/span>.*?ds-body-sm-regular ds-text-high[^"]*">([^<]+)<\/span>/g;
  for (const m of section.matchAll(re)) map.set(m[1].trim(), m[2].trim());
  return map;
}

function parseLystioListing(
  html: string,
  fallbackUrl: string,
): NormalizedListing {
  const graph = extractJsonLdGraph(html);
  const listing = graph.find((n) => n["@type"] === "RealEstateListing");
  if (!listing) {
    throw new Error(
      "Could not find listing data on the page (Lystio may have changed its page structure).",
    );
  }

  const about = listing.about as Record<string, unknown> | undefined;
  const offers = about?.offers as Record<string, unknown> | undefined;
  if (offers?.["@type"] === "AggregateOffer") {
    throw new Error(
      "This URL lists multiple units in one building, not a single listing. Open a specific unit's page and copy its URL instead.",
    );
  }

  const address = about?.address as Record<string, unknown> | undefined;
  const postalCode =
    typeof address?.postalCode === "string" ? address.postalCode : null;
  const addressParts = [
    address?.streetAddress,
    address?.addressLocality,
  ].filter((v): v is string => typeof v === "string");

  const geo = about?.geo as Record<string, unknown> | undefined;
  const latitude = typeof geo?.latitude === "number" ? geo.latitude : null;
  const longitude = typeof geo?.longitude === "number" ? geo.longitude : null;

  const floorSize = about?.floorSize as Record<string, unknown> | undefined;
  const squareMeters =
    typeof floorSize?.value === "number" ? floorSize.value : null;
  const rooms =
    typeof about?.numberOfRooms === "number" ? about.numberOfRooms : null;

  const images = Array.isArray(about?.image)
    ? (about.image as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  const idMatch = (
    typeof listing.url === "string" ? listing.url : fallbackUrl
  ).match(SOURCE_ID_PATTERN);

  const costs = extractPriceBreakdown(html);
  const rent = parseEnglishEuroAmount(costs.get("Rent"));
  const operating = parseEnglishEuroAmount(costs.get("Operating costs"));
  const deposit = parseEnglishEuroAmount(costs.get("Security Deposit"));

  const description =
    typeof listing.description === "string" ? listing.description : null;
  const combinedText = `${description ?? ""} ${typeof listing.name === "string" ? listing.name : ""}`;

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
    latitude,
    longitude,
    rooms,
    squareMeters,
    baseRent:
      rent !== null
        ? exactFact(rent, `Lystio price breakdown: Rent (${costs.get("Rent")})`)
        : unknownFact,
    operatingCosts:
      operating !== null
        ? exactFact(
            operating,
            `Lystio price breakdown: Operating costs (${costs.get("Operating costs")})`,
          )
        : unknownFact,
    deposit:
      deposit !== null
        ? exactFact(
            deposit,
            `Lystio price breakdown: Security Deposit (${costs.get("Security Deposit")})`,
          )
        : unknownFact,
    elevator: detectAmenitySignal(combinedText, ["elevator", "lift"]),
    storage: detectAmenitySignal(combinedText, [
      "cellar",
      "storage room",
      "storage unit",
    ]),
    balcony: detectAmenitySignal(combinedText, [
      "balcony",
      "loggia",
      "terrace",
    ]),
    description: stripHtml(description),
    photos: images,
  };
}

// Results are entirely client-rendered (React/Next.js), and pagination is a
// button, not a link or query param — a plain fetch only ever sees the
// server-shipped shell (confirmed empirically: 3 links in static HTML vs.
// dozens after the page hydrates). So discovery here launches a real headless
// Chromium via Playwright, clicks through "Next page" until it's disabled,
// and collects every listing link along the way. Their cookie-consent
// overlay reappears after *every* page change and blocks clicks until
// dismissed again, so dismissOverlay() runs before each click, not just once.
const MAX_SEARCH_PAGES = 15;

async function* discoverLystioListingUrls(
  searchUrl: string,
): AsyncGenerator<string> {
  await assertSafePublicUrl(searchUrl, { allowedHosts: DOMAINS });
  const allowed = await isFetchAllowedByRobots(searchUrl, BROWSER_USER_AGENT);
  if (!allowed)
    throw new Error(`robots.txt for lystio.at disallows fetching this path.`);
  await waitForRateLimit("lystio.at", 4000);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent: BROWSER_USER_AGENT,
      viewport: { width: 1400, height: 900 },
    });
    await page.route(/^https?:\/\//, async (route) => {
      try {
        const request = route.request();
        await assertSafePublicUrl(request.url(), {
          allowedHosts: request.isNavigationRequest() ? DOMAINS : undefined,
        });
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    async function dismissOverlay() {
      const cookieBtn = page.getByTestId("accept-cookies-button");
      if (await cookieBtn.isVisible().catch(() => false)) {
        await cookieBtn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    await dismissOverlay();

    const seen = new Set<string>();
    for (let pageNum = 1; pageNum <= MAX_SEARCH_PAGES; pageNum++) {
      const hrefs = await page.$$eval(
        'a[href*="/rent/apartment/vienna/"]',
        (els) => els.map((e) => e.getAttribute("href") ?? ""),
      );
      for (const href of hrefs) {
        const m = href.match(
          /^(\/en\/rent\/apartment\/vienna\/[a-z0-9-]+\/\d+)/,
        );
        if (m && !seen.has(m[1])) {
          seen.add(m[1]);
          yield `https://lystio.at${m[1]}`;
        }
      }

      const nextBtn = page.getByRole("button", { name: "Next page" });
      await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
      if (await nextBtn.isDisabled().catch(() => true)) break;

      await dismissOverlay();
      const box = await nextBtn.boundingBox();
      if (!box) break;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1500);
      await dismissOverlay();
    }
  } finally {
    await browser.close();
  }
}

export const lystioProvider: ListingProvider = {
  name: "Lystio",

  getSearchUrls() {
    return [
      {
        label: "Lystio — Apartments for rent in Vienna",
        url: "https://lystio.at/en/rent/apartment/vienna",
        description:
          "Open this, apply your filters on the map/list, then paste any listing URL here to import it automatically.",
      },
    ];
  },

  async importFromUrl(url) {
    if (!hostMatches(url)) {
      throw new Error(
        `URL host "${new URL(url).hostname}" is not a Lystio URL.`,
      );
    }
    const html = await fetchHtml(url, DOMAINS);
    return parseLystioListing(html, url);
  },

  discoverListingUrls: discoverLystioListingUrls,

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
          ...parseLystioListing(html, url),
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
        title: "Open Lystio rentals for Vienna",
        description: "Go to lystio.at → Rent → Vienna, or use the map search.",
      },
      {
        step: 2,
        title: "Apply your filters",
        description:
          "Price, rooms, size, districts — Lystio's filters live in the URL, so bookmarking the filtered map view works.",
      },
      {
        step: 3,
        title: "Paste any listing URL",
        description:
          "Use Import → Paste URL for a specific listing — it's fetched and parsed automatically. Multi-unit building listings aren't supported; open a specific unit instead.",
      },
      {
        step: 4,
        title: "Or paste alert emails",
        description:
          "If Lystio emails you new matches, use Import → Paste alert email to import every link in one go.",
      },
    ];
  },
};
