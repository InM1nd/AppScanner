import type { ListingProvider } from "@/types/provider";
import type { ProviderName } from "@/types/enums";
import { willhabenProvider } from "./willhaben";
import { immoScout24AtProvider } from "./immoscout24-at";
import { immoweltAtProvider } from "./immowelt-at";
import { derStandardProvider } from "./der-standard";
import { findMyHomeProvider } from "./findmyhome";
import { lystioProvider } from "./lystio";
import { genericUrlProvider } from "./generic-url";

// MANUAL has no adapter — manual entries are created directly via the form,
// bypassing the ListingProvider interface entirely.
export const providerRegistry: Partial<Record<ProviderName, ListingProvider>> =
  {
    WILLHABEN: willhabenProvider,
    IMMOSCOUT24_AT: immoScout24AtProvider,
    IMMOWELT_AT: immoweltAtProvider,
    DER_STANDARD: derStandardProvider,
    FINDMYHOME: findMyHomeProvider,
    LYSTIO: lystioProvider,
    GENERIC_URL: genericUrlProvider,
  };

export function getProviderAdapter(name: ProviderName): ListingProvider | null {
  return providerRegistry[name] ?? null;
}

export function detectProviderForUrl(url: string): ProviderName {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host.endsWith("willhaben.at")) return "WILLHABEN";
  if (host.endsWith("immobilienscout24.at")) return "IMMOSCOUT24_AT";
  if (host.endsWith("immowelt.at")) return "IMMOWELT_AT";
  if (host === "immobilien.derstandard.at") return "DER_STANDARD";
  if (host.endsWith("findmyhome.at")) return "FINDMYHOME";
  if (host.endsWith("lystio.at")) return "LYSTIO";
  return "GENERIC_URL";
}

export {
  willhabenProvider,
  immoScout24AtProvider,
  immoweltAtProvider,
  derStandardProvider,
  findMyHomeProvider,
  lystioProvider,
  genericUrlProvider,
};
