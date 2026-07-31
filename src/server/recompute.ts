// The single entry point for cost + score recalculation. Every caller that
// changes something that could affect a listing's numbers — import/save,
// a commute result arriving, or scoring weights changing in Settings — must
// route through this function instead of recomputing inline.

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { computeCost } from "@/lib/cost";
import { computeScore, type CommuteInput } from "@/lib/score";
import { getActiveSearchProfile } from "./current-user";
import { toScoreProfileInput } from "./search-profile-mapper";

class StaleRecomputeError extends Error {}
import { factsFromRow } from "./listing-mapper";

export async function recomputeListing(
  listingId: string,
  userId?: string,
  attempt = 0,
): Promise<void> {
  await db.listing.update({
    where: { id: listingId },
    data: { recomputePending: true },
  });
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
  });
  const resolvedUserId = userId ?? (await db.user.findFirstOrThrow()).id;
  const profileRow = await getActiveSearchProfile(resolvedUserId);
  const scoreProfile = toScoreProfileInput(profileRow);

  const facts = factsFromRow(listing);
  const cost = computeCost(
    {
      ...facts,
      parkingAvailability: listing.parkingAvailability,
      furnishedLevel: listing.furnishedLevel,
      availabilityDate: listing.availabilityDate,
    },
    scoreProfile.absoluteMonthlyMax,
  );

  const latestCommute =
    listing.latitude !== null && listing.longitude !== null
      ? await db.commuteEstimate.findFirst({
          where: {
            listingId,
            originLat: listing.latitude,
            originLng: listing.longitude,
            destLat: profileRow.workDestinationLat,
            destLng: profileRow.workDestinationLng,
          },
          orderBy: { calculatedAt: "desc" },
        })
      : null;
  const commuteInput: CommuteInput | null = latestCommute
    ? {
        durationMinutes: latestCommute.durationMinutes,
        rating: latestCommute.rating,
        provider: latestCommute.provider,
      }
    : null;

  const score = computeScore(
    {
      listingType: listing.listingType,
      contractType: listing.contractType,
      city: listing.city,
      district: listing.district,
      rooms: listing.rooms,
      hasSeparateBedroom: listing.hasSeparateBedroom,
      kitchen: listing.kitchen,
      washingMachine: listing.washingMachine,
      parkingAvailability: listing.parkingAvailability,
      availabilityDate: listing.availabilityDate,
      newerOrRenovatedSignal: listing.newerOrRenovatedSignal,
      airConditioning: listing.airConditioning,
      balcony: listing.balcony,
      elevator: listing.elevator,
      storage: listing.storage,
      quietCourtyardSignal: listing.quietCourtyardSignal,
    },
    cost,
    commuteInput,
    scoreProfile,
  );

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.listing.updateMany({
        where: { id: listingId, updatedAt: listing.updatedAt },
        data: {
          monthlyKnownCost: cost.monthlyKnownCost,
          monthlyHousingSubtotal: cost.housingSubtotal,
          monthlyLikelyTotal: cost.monthlyLikelyTotal,
          hasUnknownMandatoryCost: cost.hasUnknownMandatoryCost,
          unknownRecurringFields: cost.unknownRecurringFields,
          upfrontCostEstimate: cost.upfrontCost.total,
          upfrontKnownTotal: cost.upfrontKnownTotal,
          hasUnknownUpfrontCost: cost.hasUnknownUpfrontCost,
          unknownUpfrontFields: cost.unknownUpfrontFields,
          costRedFlags: cost.redFlags,
          recomputePending: false,
        },
      });
      if (updated.count !== 1) throw new StaleRecomputeError();
      await tx.scoreBreakdown.upsert({
        where: { listingId },
        create: {
          listingId,
          totalScore: score.totalScore,
          dataCompleteness: score.dataCompleteness,
          isZeroed: score.isZeroed,
          zeroReason: score.zeroReason,
          categories: score.categories as unknown as Prisma.InputJsonValue,
          weightsSnapshot: scoreProfile.weights,
        },
        update: {
          totalScore: score.totalScore,
          dataCompleteness: score.dataCompleteness,
          isZeroed: score.isZeroed,
          zeroReason: score.zeroReason,
          categories: score.categories as unknown as Prisma.InputJsonValue,
          weightsSnapshot: scoreProfile.weights,
          calculatedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof StaleRecomputeError && attempt < 2) {
      return recomputeListing(listingId, userId, attempt + 1);
    }
    throw error;
  }
}

export async function recomputeAllListings(userId?: string): Promise<number> {
  const listings = await db.listing.findMany({ select: { id: true } });
  for (const { id } of listings) {
    await recomputeListing(id, userId);
  }
  return listings.length;
}
