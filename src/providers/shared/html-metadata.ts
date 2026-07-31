import * as cheerio from "cheerio";

export interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  images: string[];
  price: number | null;
  priceCurrency: string | null;
  address: string | null;
}

function firstNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function flattenJsonLd(
  node: unknown,
  acc: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, acc);
  } else if (node && typeof node === "object") {
    acc.push(node as Record<string, unknown>);
    const graph = (node as Record<string, unknown>)["@graph"];
    if (graph) flattenJsonLd(graph, acc);
  }
  return acc;
}

export function extractMetadataFromHtml(html: string): ExtractedMetadata {
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr("content") ?? null;
  const ogDescription =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    null;
  const ogImages = $('meta[property="og:image"]')
    .map((_, el) => $(el).attr("content"))
    .get()
    .filter((v): v is string => Boolean(v));

  let price: number | null = null;
  let priceCurrency: string | null = null;
  let address: string | null = null;
  let jsonLdTitle: string | null = null;
  let jsonLdDescription: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const parsed = JSON.parse(raw);
      for (const node of flattenJsonLd(parsed)) {
        const offers = node.offers as
          Record<string, unknown> | Record<string, unknown>[] | undefined;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        if (offer && price === null) {
          price = firstNumber(offer.price ?? offer.priceSpecification);
          priceCurrency =
            typeof offer.priceCurrency === "string"
              ? offer.priceCurrency
              : null;
        }
        if (node.price && price === null) {
          price = firstNumber(node.price);
        }
        const addr = node.address as
          Record<string, unknown> | string | undefined;
        if (addr && !address) {
          address =
            typeof addr === "string"
              ? addr
              : [addr.streetAddress, addr.postalCode, addr.addressLocality]
                  .filter(Boolean)
                  .join(", ");
        }
        if (typeof node.name === "string" && !jsonLdTitle)
          jsonLdTitle = node.name;
        if (typeof node.description === "string" && !jsonLdDescription)
          jsonLdDescription = node.description;
      }
    } catch {
      // Malformed JSON-LD on the page — ignore this block, OG tags may still work.
    }
  });

  return {
    title: ogTitle ?? jsonLdTitle,
    description: ogDescription ?? jsonLdDescription,
    images: ogImages,
    price,
    priceCurrency,
    address,
  };
}
