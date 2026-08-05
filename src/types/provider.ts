import type { NormalizedListing } from "./listing";
import type { SearchProfile } from "./search-profile";

export class NonListingPageError extends Error {
  // Set when the page identifies *why* it's not a live listing (the source
  // itself says "gone" or "reserved/rented") rather than just having an
  // unrecognized structure. refresh.ts uses this to mark an existing
  // listing's sourceAvailability precisely instead of defaulting to GONE.
  reason?: "GONE" | "RESERVED";

  constructor(message: string, reason?: "GONE" | "RESERVED") {
    super(message);
    this.name = "NonListingPageError";
    this.reason = reason;
  }
}

export interface ProviderSearchUrl {
  label: string;
  url: string;
  description?: string;
}

export interface ProviderSetupInstruction {
  step: number;
  title: string;
  description: string;
  url?: string;
}

// Every provider must go through this interface — no direct scraping calls
// anywhere else in the app. See AGENTS.md "Ingestion rules".
export interface ImportFromUrlOptions {
  /** Skip the AI money-field fill-in — used by the hourly refresh job, since
   * a listing's description text essentially never changes after first
   * import, so re-querying the model there for a field that came back
   * UNKNOWN once is a pure repeat cost with no realistic upside. */
  skipAiExtraction?: boolean;
}

export interface ListingProvider {
  name: string;
  getSearchUrls(profile: SearchProfile): ProviderSearchUrl[];
  importFromUrl(
    url: string,
    options?: ImportFromUrlOptions,
  ): Promise<NormalizedListing>;
  parseEmailAlert?(rawEmail: string): Promise<NormalizedListing[]>;
  /** Walks a saved search's result pages and yields listing detail URLs, one page at a time. */
  discoverListingUrls?(searchUrl: string): AsyncGenerator<string>;
  getSetupInstructions(): ProviderSetupInstruction[];
}
