import { db } from "@/lib/db";
import { getCurrentUser } from "./current-user";
import type { Prisma } from "@prisma/client";

export const LISTING_CARD_INCLUDE = {
  provider: true,
  scoreBreakdown: true,
  commuteEstimates: { orderBy: { calculatedAt: "desc" }, take: 1 },
  watchlistItems: true,
} satisfies Prisma.ListingInclude;

export type ListingCard = Prisma.ListingGetPayload<{
  include: typeof LISTING_CARD_INCLUDE;
}>;

export const LISTING_DETAIL_INCLUDE = {
  provider: true,
  scoreBreakdown: true,
  commuteEstimates: { orderBy: { calculatedAt: "desc" } },
  watchlistItems: true,
  notes: { orderBy: { createdAt: "desc" } },
  snapshots: { orderBy: { capturedAt: "desc" } },
} satisfies Prisma.ListingInclude;

export type ListingDetail = Prisma.ListingGetPayload<{
  include: typeof LISTING_DETAIL_INCLUDE;
}>;

export async function listAllListings(): Promise<ListingCard[]> {
  await getCurrentUser();
  return db.listing.findMany({
    include: LISTING_CARD_INCLUDE,
    orderBy: { importedAt: "desc" },
  });
}

export async function listSavedListings(): Promise<ListingCard[]> {
  await getCurrentUser();
  return db.listing.findMany({
    where: {
      OR: [{ status: "SHORTLISTED" }, { watchlistItems: { some: {} } }],
    },
    include: LISTING_CARD_INCLUDE,
    orderBy: { importedAt: "desc" },
  });
}

export async function getListingDetail(
  id: string,
): Promise<ListingDetail | null> {
  await getCurrentUser();
  return db.listing.findUnique({
    where: { id },
    include: LISTING_DETAIL_INCLUDE,
  });
}

export async function getImportJob(id: string) {
  await getCurrentUser();
  return db.importJob.findUnique({
    where: { id },
    include: { provider: true },
  });
}
