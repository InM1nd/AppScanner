import { db } from "@/lib/db";
import { Prisma, type ListingStatus } from "@prisma/client";
import type { ProviderName } from "@/types/enums";
import type { NormalizedListing } from "@/types/listing";
import {
  findDuplicateMatch,
  normalizeCanonicalUrl,
  type DuplicateCandidate,
} from "@/lib/duplicate";
import { validateListingDraft } from "@/lib/validation";
import {
  MONEY_FIELDS,
  factsToColumns,
  factsToSparseColumns,
} from "./listing-mapper";
import {
  changedSnapshotFields,
  type SnapshotScalar,
} from "@/lib/listing-snapshot";
import { recomputeListing } from "./recompute";
import { toNum } from "./decimal";
import { getOwnerUser } from "./current-user";
import { notifyNewHighScore, notifyPriceDrop } from "./notifications";
import { inngest } from "@/inngest/client";

export class DuplicateListingError extends Error {
  constructor(
    public matchedListingId: string,
    public reason: string,
  ) {
    super(`Likely duplicate of an existing listing (${reason}).`);
  }
}

async function getOrCreateProvider(name: ProviderName) {
  return db.provider.upsert({
    where: { name },
    update: {},
    create: { name, displayName: name },
  });
}

async function recomputeAfterWrite(listingId: string): Promise<boolean> {
  try {
    await recomputeListing(listingId);
    return true;
  } catch (error) {
    console.error(`Failed to recompute listing ${listingId}.`, error);
    if (process.env.NODE_ENV !== "production") throw error;
    try {
      await inngest.send({
        name: "appscanner/recompute-all.requested",
        data: {},
      });
    } catch (enqueueError) {
      console.error(
        `Failed to enqueue recompute recovery for listing ${listingId}.`,
        enqueueError,
      );
      // recomputePending is also recovered by the scheduled recovery job.
    }
    return false;
  }
}

function listingSnapshotValues(
  listing: Record<string, unknown>,
): Record<string, SnapshotScalar> {
  const values: Record<string, SnapshotScalar> = {};
  for (const field of [
    "title",
    "address",
    "district",
    "rooms",
    "squareMeters",
    "contractType",
    "furnishedLevel",
  ]) {
    const value = listing[field];
    values[field] =
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
        ? value
        : null;
  }
  const availabilityDate = listing.availabilityDate;
  values.availabilityDate =
    availabilityDate instanceof Date
      ? availabilityDate.toISOString()
      : typeof availabilityDate === "string"
        ? availabilityDate
        : null;
  for (const field of MONEY_FIELDS) {
    const key = `${field}Amount`;
    values[key] = toNum(listing[key] as Parameters<typeof toNum>[0]);
  }
  return values;
}

async function findDuplicate(candidate: DuplicateCandidate) {
  const pool = await db.listing.findMany({
    select: {
      id: true,
      providerId: true,
      sourceListingId: true,
      canonicalUrl: true,
      address: true,
      district: true,
      rooms: true,
      squareMeters: true,
      baseRentAmount: true,
      advertisedMonthlyTotalAmount: true,
    },
  });
  const existing: DuplicateCandidate[] = pool.map((row) => ({
    id: row.id,
    providerId: row.providerId,
    sourceListingId: row.sourceListingId,
    canonicalUrl: row.canonicalUrl,
    address: row.address,
    district: row.district,
    rooms: row.rooms,
    squareMeters: row.squareMeters,
    baseRentAmount: toNum(row.baseRentAmount),
    advertisedMonthlyTotalAmount: toNum(row.advertisedMonthlyTotalAmount),
  }));
  return findDuplicateMatch(candidate, existing);
}

// Shared between create and refresh — every column derived from a draft
// except identity fields (providerId, duplicateClusterId) that only make
// sense at creation time.
function draftToListingFields(draft: NormalizedListing) {
  return {
    title: draft.title,
    sourceListingId: draft.sourceListingId,
    canonicalUrl: draft.canonicalUrl,
    importMethod: draft.importMethod,
    createdAtSource: draft.createdAtSource,
    listingType: draft.listingType,
    city: draft.city,
    address: draft.address,
    postalCode: draft.postalCode,
    district: draft.district,
    latitude: draft.latitude,
    longitude: draft.longitude,
    rooms: draft.rooms,
    squareMeters: draft.squareMeters,
    hasSeparateBedroom: draft.hasSeparateBedroom,
    furnishedLevel: draft.furnishedLevel,
    ...factsToColumns({
      advertisedMonthlyTotal: draft.advertisedMonthlyTotal,
      baseRent: draft.baseRent,
      operatingCosts: draft.operatingCosts,
      heatingCost: draft.heatingCost,
      hotWaterCost: draft.hotWaterCost,
      electricityEstimate: draft.electricityEstimate,
      internetEstimate: draft.internetEstimate,
      parkingMonthlyCost: draft.parkingMonthlyCost,
      deposit: draft.deposit,
      commission: draft.commission,
      contractFee: draft.contractFee,
    }),
    availabilityDate: draft.availabilityDate,
    contractType: draft.contractType,
    kitchen: draft.kitchen,
    washingMachine: draft.washingMachine,
    parkingAvailability: draft.parkingAvailability,
    elevator: draft.elevator,
    balcony: draft.balcony,
    airConditioning: draft.airConditioning,
    storage: draft.storage,
    quietCourtyardSignal: draft.quietCourtyardSignal,
    newerOrRenovatedSignal: draft.newerOrRenovatedSignal,
    heatingType: draft.heatingType,
    energyRating: draft.energyRating,
    description: draft.description,
    photos: draft.photos,
    contactMethod: draft.contactMethod,
  };
}

function draftToSparseListingFields(
  draft: NormalizedListing,
): Prisma.ListingUpdateInput {
  const fields = draftToListingFields(draft);
  const sparse = Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => {
      if (["sourceListingId", "canonicalUrl", "importMethod"].includes(key))
        return false;
      if (value === null || value === "UNKNOWN" || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return !/(Amount|Confidence|SourceText)$/.test(key);
    }),
  );

  return {
    ...sparse,
    ...factsToSparseColumns({
      advertisedMonthlyTotal: draft.advertisedMonthlyTotal,
      baseRent: draft.baseRent,
      operatingCosts: draft.operatingCosts,
      heatingCost: draft.heatingCost,
      hotWaterCost: draft.hotWaterCost,
      electricityEstimate: draft.electricityEstimate,
      internetEstimate: draft.internetEstimate,
      parkingMonthlyCost: draft.parkingMonthlyCost,
      deposit: draft.deposit,
      commission: draft.commission,
      contractFee: draft.contractFee,
    }),
  } as Prisma.ListingUpdateInput;
}

export interface CreateListingOptions {
  providerName: ProviderName;
  draft: NormalizedListing;
  /** Skip the hard-reject on an exact duplicate match (used by the review UI's "save anyway"). */
  allowExactDuplicate?: boolean;
}

export async function createListingFromDraft({
  providerName,
  draft,
  allowExactDuplicate,
}: CreateListingOptions) {
  const validation = validateListingDraft(draft);
  if (!validation.valid) {
    throw new Error(`Invalid listing draft: ${validation.errors.join("; ")}`);
  }

  const provider = await getOrCreateProvider(providerName);
  if (!provider.isEnabled)
    throw new Error(`Provider ${providerName} is disabled.`);

  const duplicate = await findDuplicate({
    id: "__candidate__",
    providerId: provider.id,
    sourceListingId: draft.sourceListingId,
    canonicalUrl: draft.canonicalUrl,
    address: draft.address,
    district: draft.district,
    rooms: draft.rooms,
    squareMeters: draft.squareMeters,
    baseRentAmount: draft.baseRent.amount,
    advertisedMonthlyTotalAmount: draft.advertisedMonthlyTotal.amount,
  });

  if (
    duplicate &&
    (duplicate.reason === "SAME_URL" ||
      duplicate.reason === "SAME_PROVIDER_SOURCE_ID") &&
    !allowExactDuplicate
  ) {
    throw new DuplicateListingError(
      duplicate.matchedListingId,
      duplicate.reason,
    );
  }

  const normalizedCanonicalUrl =
    normalizeCanonicalUrl(draft.canonicalUrl) || null;
  let listing;
  try {
    listing = await db.$transaction(async (tx) => {
      let duplicateClusterId: string | null = null;
      if (duplicate) {
        await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${duplicate.matchedListingId} FOR UPDATE`;
        const matched = await tx.listing.findUniqueOrThrow({
          where: { id: duplicate.matchedListingId },
          select: { duplicateClusterId: true },
        });
        if (matched.duplicateClusterId) {
          duplicateClusterId = matched.duplicateClusterId;
        } else {
          const cluster = await tx.duplicateCluster.create({
            data: {
              reason: duplicate.reason,
              primaryListingId: duplicate.matchedListingId,
            },
          });
          duplicateClusterId = cluster.id;
          await tx.listing.update({
            where: { id: duplicate.matchedListingId },
            data: { duplicateClusterId },
          });
        }
      }

      const created = await tx.listing.create({
        data: {
          ...draftToListingFields(draft),
          providerId: provider.id,
          duplicateClusterId,
          normalizedCanonicalUrl:
            duplicate && allowExactDuplicate ? null : normalizedCanonicalUrl,
          sourceAvailability: providerName === "MANUAL" ? "UNKNOWN" : "ACTIVE",
          recomputePending: true,
        },
      });
      await tx.listingSnapshot.create({
        data: {
          listingId: created.id,
          changeType: "IMPORTED",
          fields: {
            title: created.title,
            baseRentAmount: toNum(created.baseRentAmount),
            availabilityDate: created.availabilityDate,
          },
          changeSummary: `Imported via ${draft.importMethod}.`,
        },
      });
      return created;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const matched = await db.listing.findFirst({
        where: {
          OR: [
            ...(normalizedCanonicalUrl ? [{ normalizedCanonicalUrl }] : []),
            ...(draft.sourceListingId
              ? [
                  {
                    providerId: provider.id,
                    sourceListingId: draft.sourceListingId,
                  },
                ]
              : []),
          ],
        },
        select: { id: true },
      });
      if (matched) throw new DuplicateListingError(matched.id, "SAME_URL");
    }
    throw error;
  }

  const recomputed = await recomputeAfterWrite(listing.id);

  if (recomputed) {
    try {
      const user = await getOwnerUser();
      await notifyNewHighScore(user.id, listing.id);
    } catch {
      // Notifications are best-effort — a Telegram/network failure must never block a save.
    }
  }

  return db.listing.findUniqueOrThrow({
    where: { id: listing.id },
    include: { scoreBreakdown: true, provider: true },
  });
}

// Re-fetched data overwriting an existing row — used by the refresh job to
// pick up price/status changes since the listing was first imported.
// Doesn't touch providerId/duplicateClusterId (identity, set once at
// creation) or the app's own workflow `status` (NEW/SHORTLISTED/etc —
// that's the user's tracking state, not something a re-fetch should reset).
export async function updateListingFromDraft(
  listingId: string,
  draft: NormalizedListing,
) {
  const before = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { scoreBreakdown: true },
  });

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.listing.update({
      where: { id: listingId },
      data: { ...draftToSparseListingFields(draft), recomputePending: true },
    });
    const fields = changedSnapshotFields(
      listingSnapshotValues(before as unknown as Record<string, unknown>),
      listingSnapshotValues(row as unknown as Record<string, unknown>),
    );
    await tx.listingSnapshot.create({
      data: {
        listingId,
        changeType: "REFRESHED",
        fields,
        changeSummary: `Refreshed from source (${Object.keys(fields).length} fields changed).`,
      },
    });
    return row;
  });

  const recomputed = await recomputeAfterWrite(listingId);

  if (recomputed) {
    const after = await db.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { scoreBreakdown: true, watchlistItems: true },
    });
    try {
      const user = await getOwnerUser();
      const watched = after.watchlistItems.some(
        (item) => item.userId === user.id && item.notifyOnPriceChange,
      );
      const oldTotal = toNum(before.monthlyLikelyTotal);
      const newTotal = toNum(after.monthlyLikelyTotal);
      if (
        watched &&
        !before.hasUnknownMandatoryCost &&
        !after.hasUnknownMandatoryCost &&
        oldTotal !== null &&
        newTotal !== null &&
        newTotal < oldTotal
      ) {
        await notifyPriceDrop(user.id, listingId, oldTotal, newTotal);
      }
      const wasStrong =
        (before.scoreBreakdown?.totalScore ?? 0) >= 70 &&
        (before.scoreBreakdown?.dataCompleteness ?? 0) >= 70 &&
        !before.scoreBreakdown?.isZeroed;
      if (!wasStrong) await notifyNewHighScore(user.id, listingId);
    } catch {
      // Notifications are best-effort — a Telegram/network failure must never block a refresh.
    }
  }
  return updated;
}

export async function updateListingStatus(
  listingId: string,
  status: ListingStatus,
  rejectionReason?: string,
) {
  const before = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
  });
  const updated = await db.listing.update({
    where: { id: listingId },
    data: { status, rejectionReason: rejectionReason ?? null },
  });

  if (before.status !== updated.status) {
    await db.listingSnapshot.create({
      data: {
        listingId,
        changeType: "STATUS_CHANGE",
        fields: { from: before.status, to: updated.status },
        changeSummary: `Status changed from ${before.status} to ${updated.status}.`,
      },
    });
  }

  return updated;
}

export async function addNote(listingId: string, userId: string, body: string) {
  return db.note.create({ data: { listingId, userId, body } });
}
