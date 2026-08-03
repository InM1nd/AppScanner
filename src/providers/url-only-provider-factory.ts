// Factory for the five Vienna real-estate sites. All five follow the same
// shape: no automated fetching (see url-only-listing.ts), a best-effort
// saved-search URL for the user to open manually, and an email-alert parser.
// Extend this file's PROVIDER_CONFIGS instead of writing a new class per site.

import type {
  ListingProvider,
  ProviderSearchUrl,
  ProviderSetupInstruction,
} from "@/types/provider";
import type { SearchProfile } from "@/types/search-profile";
import {
  buildUrlOnlyDraft,
  matchesProviderHost,
} from "./shared/url-only-listing";
import { extractListingsFromEmail } from "./shared/email-alert-parsing";

export interface UrlOnlyProviderConfig {
  name: string;
  domains: string[];
  sourceListingIdPattern: RegExp;
  listingUrlPattern: RegExp;
  buildSearchUrls: (profile: SearchProfile) => ProviderSearchUrl[];
  setupInstructions: ProviderSetupInstruction[];
}

export function createUrlOnlyProvider(
  config: UrlOnlyProviderConfig,
): ListingProvider {
  return {
    name: config.name,

    getSearchUrls(profile) {
      return config.buildSearchUrls(profile);
    },

    async importFromUrl(url) {
      if (!matchesProviderHost(url, config.domains)) {
        throw new Error(
          `URL host "${new URL(url).hostname}" does not match provider "${config.name}" (expected one of: ${config.domains.join(", ")}).`,
        );
      }
      return buildUrlOnlyDraft(url, config.sourceListingIdPattern);
    },

    async parseEmailAlert(rawEmail) {
      return extractListingsFromEmail(
        rawEmail,
        config.listingUrlPattern,
        config.sourceListingIdPattern,
      );
    },

    getSetupInstructions() {
      return config.setupInstructions;
    },
  };
}
