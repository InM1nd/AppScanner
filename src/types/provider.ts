import type { NormalizedListing } from "./listing";
import type { SearchProfile } from "./search-profile";

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
export interface ListingProvider {
  name: string;
  getSearchUrls(profile: SearchProfile): ProviderSearchUrl[];
  importFromUrl(url: string): Promise<NormalizedListing>;
  parseEmailAlert?(rawEmail: string): Promise<NormalizedListing[]>;
  /** Walks a saved search's result pages and yields listing detail URLs, one page at a time. */
  discoverListingUrls?(searchUrl: string): AsyncGenerator<string>;
  getSetupInstructions(): ProviderSetupInstruction[];
}
