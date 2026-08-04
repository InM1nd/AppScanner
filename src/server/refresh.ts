// Re-fetches an existing listing's canonicalUrl and either marks its source
// as gone or updates it with fresh data (price/
// status changes since it was first imported). Unlike the search crawler,
// this walks existing DB rows, not a saved search's result pages. Exposed
// both as a bulk job (refreshExistingListings, cron/manual "refresh all")
// and a single-listing action (refreshSingleListing, the detail page's
// "Refresh from source" button).

import { db } from "@/lib/db";
import { getProviderAdapter } from "@/providers";
import type { ProviderName } from "@/types/enums";
import type { Listing, Provider } from "@prisma/client";
import { NonListingPageError } from "@/types/provider";
import { updateListingFromDraft } from "./listings";

// Only providers whose importFromUrl actually fetches the page (see each
// adapter's file header) are worth re-fetching — Immowelt/derStandard/
// FindMyHome's importFromUrl just re-parses the URL string, so refreshing
// them would reproduce the exact same draft every time.
const REAL_FETCH_PROVIDERS = new Set<ProviderName>([
  "WILLHABEN",
  "IMMOSCOUT24_AT",
  "LYSTIO",
  "GENERIC_URL",
]);

// A real HTTP 404/410 is as good as a "gone" text signal for "this is
// gone" — IS24 uses 410 Gone; Willhaben/Lystio instead render a normal 200
// page with a "no longer available" notice, which each adapter now detects
// itself and surfaces as a NonListingPageError with `.reason` set (see
// text-signals.ts's detectSourceUnavailableSignal).
function looksGone(errorMessage: string): boolean {
  return /Fetch failed with status (404|410)\b/.test(errorMessage);
}

export type RefreshResult =
  "updated" | "marked_reserved" | "marked_gone" | "skipped";

async function markAvailability(
  listingId: string,
  providerId: string,
  availability: "RESERVED" | "GONE",
) {
  await db.$transaction(async (tx) => {
    const changed = await tx.listing.updateMany({
      where: { id: listingId, sourceAvailability: { not: availability } },
      data: {
        sourceAvailability: availability,
        lastSourceCheckedAt: new Date(),
      },
    });
    if (changed.count === 1) {
      await tx.listingSnapshot.create({
        data: {
          listingId,
          changeType: "AVAILABILITY_CHANGE",
          fields: { sourceAvailability: availability },
          changeSummary: `Source availability changed to ${availability}.`,
        },
      });
    }
    await tx.provider.updateMany({
      where: { id: providerId, healthStatus: { notIn: ["DEGRADED", "DOWN"] } },
      data: { healthStatus: "OK", lastHealthCheckAt: new Date() },
    });
  });
}

async function refreshOneListing(
  listing: Listing & { provider: Provider },
): Promise<{ result: RefreshResult; error?: string }> {
  const providerName = listing.provider.name;
  if (!listing.provider.isEnabled)
    return { result: "skipped", error: "Provider is disabled." };
  if (!REAL_FETCH_PROVIDERS.has(providerName))
    return {
      result: "skipped",
      error: "Provider doesn't support real re-fetch.",
    };
  const adapter = getProviderAdapter(providerName);
  if (!adapter)
    return {
      result: "skipped",
      error: "No adapter registered for this provider.",
    };

  try {
    const draft = await adapter.importFromUrl(listing.canonicalUrl);
    await updateListingFromDraft(listing.id, draft);
    await db.$transaction([
      db.listing.update({
        where: { id: listing.id },
        data: { sourceAvailability: "ACTIVE", lastSourceCheckedAt: new Date() },
      }),
      db.provider.updateMany({
        where: {
          id: listing.providerId,
          healthStatus: { notIn: ["DEGRADED", "DOWN"] },
        },
        data: { healthStatus: "OK", lastHealthCheckAt: new Date() },
      }),
    ]);
    return { result: "updated" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof NonListingPageError && error.reason) {
      await markAvailability(listing.id, listing.providerId, error.reason);
      return {
        result: error.reason === "RESERVED" ? "marked_reserved" : "marked_gone",
      };
    }
    if (looksGone(message)) {
      await markAvailability(listing.id, listing.providerId, "GONE");
      return { result: "marked_gone" };
    }
    await db.provider.update({
      where: { id: listing.providerId },
      data: {
        healthStatus: "DEGRADED",
        lastHealthCheckAt: new Date(),
        lastError: message.slice(0, 1000),
      },
    });
    return { result: "skipped", error: message };
  }
}

export async function refreshSingleListing(
  listingId: string,
): Promise<{ result: RefreshResult; error?: string }> {
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { provider: true },
  });
  return refreshOneListing(listing);
}

export async function listRefreshableListingIds(): Promise<string[]> {
  const rows = await db.listing.findMany({
    where: {
      provider: {
        isEnabled: true,
        name: { in: [...REAL_FETCH_PROVIDERS] },
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return rows.map(({ id }) => id);
}

export interface RefreshSummary {
  checked: number;
  updated: number;
  removedReserved: number;
  removedGone: number;
  skipped: number;
  errors: string[];
}

let isRunning = false;

export async function refreshExistingListings(): Promise<
  RefreshSummary | { skipped: "already_running" }
> {
  if (isRunning) return { skipped: "already_running" };
  isRunning = true;

  const summary: RefreshSummary = {
    checked: 0,
    updated: 0,
    removedReserved: 0,
    removedGone: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const listings = await db.listing.findMany({ include: { provider: true } });

    for (const listing of listings) {
      if (!REAL_FETCH_PROVIDERS.has(listing.provider.name)) continue;
      summary.checked++;

      const { result, error } = await refreshOneListing(listing);
      if (result === "updated") summary.updated++;
      else if (result === "marked_reserved") summary.removedReserved++;
      else if (result === "marked_gone") summary.removedGone++;
      else {
        summary.skipped++;
        if (error)
          summary.errors.push(
            `${listing.provider.name} ${listing.canonicalUrl}: ${error}`,
          );
      }
    }
  } finally {
    isRunning = false;
  }

  return summary;
}
