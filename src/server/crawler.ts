// Search crawler: walks each saved search's result pages (via the owning
// provider's `discoverListingUrls`), fetches+parses every discovered listing,
// and saves it through the normal import pipeline (dedup + recompute already
// live in createListingFromDraft — see AGENTS.md "Score/cost recomputation").
//
// Bounded by fetch count, not page count — one detail-page fetch costs ~4s
// (see shared/rate-limit.ts), so an unbounded crawl of a large search would
// blow past any reasonable request/cron timeout. A module-level in-flight
// guard stops a slow run from overlapping the next cron tick, since dedup
// here is read-then-write with no DB unique constraint to catch a race.

import { db } from "@/lib/db";
import { getProviderAdapter } from "@/providers";
import type { ProviderName } from "@/types/enums";
import { createListingFromDraft, DuplicateListingError } from "./listings";

const PER_SEARCH_FETCH_CAP = Number(
  process.env.CRAWLER_PER_SEARCH_FETCH_CAP ?? 15,
);
const GLOBAL_FETCH_CAP = Number(process.env.CRAWLER_GLOBAL_FETCH_CAP ?? 40);
const DUPLICATE_STREAK_LIMIT = 6;

// Only providers confirmed to default-sort newest-first get the
// duplicate-streak early stop; a search sorted otherwise would falsely look
// "caught up" a few pages in and silently miss older-but-still-new results.
// Willhaben's own default is newest-first (published.descending / sort=1),
// but a saved search URL can override that (e.g. sort=3 = rent ascending) —
// in which case the streak assumption doesn't hold for that search either.
function assumesNewestFirst(
  providerName: ProviderName,
  searchUrl: string,
): boolean {
  if (providerName !== "WILLHABEN") return false;
  const sort = new URL(searchUrl).searchParams.get("sort");
  return sort === null || sort === "1";
}

export interface CrawlSummary {
  savedSearchesProcessed: number;
  found: number;
  saved: number;
  duplicates: number;
  skippedReserved: number;
  failed: number;
  errors: string[];
}

let isRunning = false;

export async function listCrawlerSavedSearchIds(): Promise<string[]> {
  const rows = await db.savedSearch.findMany({
    where: { provider: { isEnabled: true } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: Math.max(1, Math.ceil(GLOBAL_FETCH_CAP / PER_SEARCH_FETCH_CAP)),
  });
  return rows.map(({ id }) => id);
}

export async function runSearchCrawler(
  savedSearchId?: string,
): Promise<CrawlSummary | { skipped: "already_running" }> {
  if (isRunning) return { skipped: "already_running" };
  isRunning = true;

  const summary: CrawlSummary = {
    savedSearchesProcessed: 0,
    found: 0,
    saved: 0,
    duplicates: 0,
    skippedReserved: 0,
    failed: 0,
    errors: [],
  };

  try {
    const savedSearches = await db.savedSearch.findMany({
      where: {
        ...(savedSearchId ? { id: savedSearchId } : {}),
        provider: { isEnabled: true },
      },
      include: { provider: true },
      orderBy: { id: "asc" },
    });
    let globalFetches = 0;

    for (const savedSearch of savedSearches) {
      if (globalFetches >= GLOBAL_FETCH_CAP) break;

      const providerName = savedSearch.provider.name;
      const adapter = getProviderAdapter(providerName);
      if (!adapter?.discoverListingUrls) continue; // URL-only providers can't be crawled

      summary.savedSearchesProcessed++;
      let searchFetches = 0;
      let duplicateStreak = 0;
      const errorsBefore = summary.errors.length;
      const stopOnStreak = assumesNewestFirst(
        providerName,
        savedSearch.searchUrl,
      );

      // A page-level failure (bad saved-search URL, site hiccup, a stray
      // 404 while paginating) must not take down the whole run — log it
      // and move on to the next saved search instead.
      try {
        for await (const url of adapter.discoverListingUrls(
          savedSearch.searchUrl,
        )) {
          if (
            searchFetches >= PER_SEARCH_FETCH_CAP ||
            globalFetches >= GLOBAL_FETCH_CAP
          )
            break;
          searchFetches++;
          globalFetches++;
          summary.found++;

          try {
            const draft = await adapter.importFromUrl(url);
            duplicateStreak = 0;
            await createListingFromDraft({ providerName, draft });
            summary.saved++;
          } catch (error) {
            if (error instanceof DuplicateListingError) {
              summary.duplicates++;
              duplicateStreak++;
              if (stopOnStreak && duplicateStreak >= DUPLICATE_STREAK_LIMIT)
                break;
            } else {
              summary.failed++;
              summary.errors.push(
                `${providerName} ${url}: ${error instanceof Error ? error.message : String(error)}`,
              );
              duplicateStreak = 0;
            }
          }
        }
        const runErrors = summary.errors.slice(errorsBefore);
        await db.provider.update({
          where: { id: savedSearch.providerId },
          data: {
            healthStatus: runErrors.length === 0 ? "OK" : "DEGRADED",
            lastHealthCheckAt: new Date(),
            lastError:
              runErrors.length === 0
                ? null
                : runErrors.join("\n").slice(0, 1000),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push(
          `${providerName} saved search "${savedSearch.label}" (pagination): ${message}`,
        );
        await db.provider.update({
          where: { id: savedSearch.providerId },
          data: {
            healthStatus: "DEGRADED",
            lastHealthCheckAt: new Date(),
            lastError: message.slice(0, 1000),
          },
        });
      }
    }
  } finally {
    isRunning = false;
  }

  return summary;
}
