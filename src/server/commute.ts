import { db } from "@/lib/db";
import { getRoutingProvider, classifyCommuteRating } from "@/lib/commute";
import { getActiveSearchProfile } from "./current-user";
import { notifyNewHighScore } from "./notifications";
import { recomputeListing } from "./recompute";

export async function calculateCommuteForListing(
  listingId: string,
  userId: string,
): Promise<boolean> {
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { scoreBreakdown: true },
  });
  if (listing.latitude === null || listing.longitude === null) {
    return false; // no coordinates — leave as "commute not calculated", never guess
  }

  const profile = await getActiveSearchProfile(userId);
  const routingProvider = getRoutingProvider();
  const result = await routingProvider.computeCommute(
    { lat: listing.latitude, lng: listing.longitude },
    { lat: profile.workDestinationLat, lng: profile.workDestinationLng },
  );
  if (!result) return false;

  await db.commuteEstimate.create({
    data: {
      listingId,
      provider: result.provider,
      originLat: listing.latitude,
      originLng: listing.longitude,
      destLat: profile.workDestinationLat,
      destLng: profile.workDestinationLng,
      durationMinutes: result.durationMinutes,
      walkingMinutes: result.walkingMinutes,
      transfers: result.transfers,
      routeSummary: result.routeSummary,
      rating: classifyCommuteRating(
        result.durationMinutes,
        profile.maxCommuteMinutes,
      ),
    },
  });

  await recomputeListing(listingId, userId);
  const wasStrong =
    (listing.scoreBreakdown?.totalScore ?? 0) >= 70 &&
    (listing.scoreBreakdown?.dataCompleteness ?? 0) >= 70 &&
    !listing.scoreBreakdown?.isZeroed;
  if (!wasStrong) {
    try {
      await notifyNewHighScore(userId, listingId);
    } catch {
      // Commute persistence must not be rolled back by a notification failure.
    }
  }
  return true;
}

export async function recalculateAllCommutes(userId: string) {
  const listings = await db.listing.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { id: true },
  });
  let calculated = 0;
  const errors: { listingId: string; message: string }[] = [];
  for (const { id } of listings) {
    try {
      if (await calculateCommuteForListing(id, userId)) calculated++;
    } catch (error) {
      errors.push({
        listingId: id,
        message:
          error instanceof Error ? error.message : "Unknown commute error.",
      });
    }
  }
  return {
    total: listings.length,
    calculated,
    failed: errors.length,
    errors,
  };
}
