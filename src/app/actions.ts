"use server";

import { revalidatePath } from "next/cache";
import type { ListingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/current-user";
import {
  startUrlImportJob,
  startEmailImportJob,
  finalizeImportJob,
  saveManualListing,
  blankManualDraft,
} from "@/server/import";
import { updateListingStatus, addNote } from "@/server/listings";
import { createSavedSearch, deleteSavedSearch } from "@/server/saved-searches";
import {
  refreshSingleListing,
  refreshExistingListings,
} from "@/server/refresh";
import { recomputeAllListings } from "@/server/recompute";
import { calculateCommuteForListing } from "@/server/commute";
import { sendTelegramTest } from "@/server/notifications";
import { scoringWeights, searchProfile } from "@/types/search-profile";
import { toDomainSearchProfile } from "@/server/search-profile-mapper";
import { normalizedListing, type NormalizedListing } from "@/types/listing";
import type { ProviderName } from "@/types/enums";
import { inngest } from "@/inngest/client";

export async function importFromUrlAction(url: string) {
  const user = await getCurrentUser();
  const job = await startUrlImportJob(user.id, url);
  const parsed = normalizedListing.safeParse(job.rawParsed);
  return {
    id: job.id,
    status:
      job.status === "NEEDS_REVIEW" && !parsed.success
        ? ("FAILED" as const)
        : job.status,
    errorMessage:
      job.status === "NEEDS_REVIEW" && !parsed.success
        ? "Parsed listing data is invalid."
        : job.errorMessage,
    drafts: parsed.success ? [parsed.data] : [],
  };
}

export async function importFromEmailAction(
  providerName: ProviderName,
  rawEmail: string,
) {
  const user = await getCurrentUser();
  const job = await startEmailImportJob(user.id, providerName, rawEmail);
  const parsed = normalizedListing.array().safeParse(job.rawParsed);
  return {
    id: job.id,
    status:
      job.status === "NEEDS_REVIEW" && !parsed.success
        ? ("FAILED" as const)
        : job.status,
    errorMessage:
      job.status === "NEEDS_REVIEW" && !parsed.success
        ? "Parsed listing data is invalid."
        : job.errorMessage,
    drafts: parsed.success ? parsed.data : [],
  };
}

export async function getBlankManualDraftAction() {
  await getCurrentUser();
  return blankManualDraft();
}

export async function finalizeImportJobAction(
  jobId: string,
  draft: unknown,
  allowExactDuplicate = false,
) {
  await getCurrentUser();
  const parsed = normalizedListing.parse(draft);
  const listing = await finalizeImportJob(jobId, parsed, allowExactDuplicate);
  revalidatePath("/listings");
  revalidatePath("/");
  // Decimal fields on the raw listing can't cross the Server Action ->
  // Client Component boundary — only return what the UI actually needs.
  return { id: listing.id, title: listing.title };
}

export async function saveManualListingAction(
  draft: unknown,
  allowExactDuplicate = false,
) {
  const parsed: NormalizedListing = normalizedListing.parse(draft);
  const user = await getCurrentUser();
  const listing = await saveManualListing(user.id, parsed, allowExactDuplicate);
  revalidatePath("/listings");
  revalidatePath("/");
  return { id: listing.id, title: listing.title };
}

export async function updateListingStatusAction(
  listingId: string,
  status: ListingStatus,
  rejectionReason?: string,
) {
  await getCurrentUser();
  const updated = await updateListingStatus(listingId, status, rejectionReason);
  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
  return { id: updated.id, status: updated.status };
}

export async function addNoteAction(listingId: string, body: string) {
  const user = await getCurrentUser();
  const note = await addNote(listingId, user.id, body);
  revalidatePath(`/listings/${listingId}`);
  return { id: note.id };
}

export async function toggleWatchlistAction(listingId: string) {
  const user = await getCurrentUser();
  const existing = await db.watchlistItem.findUnique({
    where: { userId_listingId: { userId: user.id, listingId } },
  });
  if (existing) {
    await db.watchlistItem.delete({ where: { id: existing.id } });
  } else {
    await db.watchlistItem.create({ data: { userId: user.id, listingId } });
  }
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  return { watching: !existing };
}

export async function scheduleViewingAction(
  listingId: string,
  scheduledAt: string,
) {
  const user = await getCurrentUser();
  const date = new Date(scheduledAt);
  if (!Number.isFinite(date.getTime()) || date <= new Date())
    throw new Error("Viewing time must be in the future.");
  await db.$transaction([
    db.watchlistItem.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId, scheduledViewingAt: date },
      update: { scheduledViewingAt: date },
    }),
    db.listing.update({
      where: { id: listingId },
      data: { status: "VIEWING" },
    }),
  ]);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  return { scheduledViewingAt: date.toISOString() };
}

export async function calculateCommuteAction(listingId: string) {
  const user = await getCurrentUser();
  if (process.env.NODE_ENV === "production") {
    await inngest.send({
      name: "appscanner/commute-one.requested",
      data: { listingId },
    });
    return { calculated: false, queued: true };
  }
  const ok = await calculateCommuteForListing(listingId, user.id);
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  return { calculated: ok };
}

export async function updateScoringWeightsAction(weights: unknown) {
  const parsed = scoringWeights.parse(weights);
  const user = await getCurrentUser();
  const profile = await db.searchProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!profile) throw new Error("No active search profile found.");
  await db.$transaction([
    db.searchProfile.update({
      where: { id: profile.id },
      data: { scoringWeights: parsed },
    }),
    db.listing.updateMany({ data: { recomputePending: true } }),
  ]);
  if (process.env.NODE_ENV === "production") {
    await inngest.send({
      name: "appscanner/recompute-all.requested",
      data: {},
    });
    revalidatePath("/settings");
    return { recalculated: 0, queued: true };
  }
  const count = await recomputeAllListings(user.id);
  revalidatePath("/listings");
  revalidatePath("/");
  return { recalculated: count };
}

export async function updateAiExtractionEnabledAction(enabled: boolean) {
  const user = await getCurrentUser();
  const profile = await db.searchProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!profile) throw new Error("No active search profile found.");
  await db.searchProfile.update({
    where: { id: profile.id },
    data: { aiExtractionEnabled: enabled },
  });
  revalidatePath("/settings");
}

export async function sendTelegramTestAction() {
  const user = await getCurrentUser();
  return sendTelegramTest(user.id);
}

export async function updateSearchProfileAction(data: unknown) {
  const user = await getCurrentUser();
  const profile = await db.searchProfile.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!profile) throw new Error("No active search profile found.");
  const parsed = searchProfile.parse({
    ...toDomainSearchProfile(profile),
    ...(data as object),
  });
  await db.$transaction([
    db.searchProfile.update({
      where: { id: profile.id },
      data: {
        city: parsed.city,
        preferredDistricts: parsed.preferredDistricts,
        secondaryDistricts: parsed.secondaryDistricts,
        workDestinationLabel: parsed.workDestinationLabel,
        workDestinationLat: parsed.workDestinationLat,
        workDestinationLng: parsed.workDestinationLng,
        maxCommuteMinutes: parsed.maxCommuteMinutes,
        requireSeparateBedroom: parsed.requireSeparateBedroom,
        minRooms: parsed.minRooms,
        targetMonthlyMin: parsed.targetMonthlyMin,
        targetMonthlyMax: parsed.targetMonthlyMax,
        absoluteMonthlyMax: parsed.absoluteMonthlyMax,
        energyMonthlyEstimate: parsed.energyMonthlyEstimate,
        internetMonthlyEstimate: parsed.internetMonthlyEstimate,
        moveInEarliest: parsed.moveInEarliest,
        moveInLatest: parsed.moveInLatest,
        needsFittedKitchen: parsed.needsFittedKitchen,
        needsWashingMachine: parsed.needsWashingMachine,
        parkingRequired: parsed.parkingRequired,
        petsAllowed: parsed.petsAllowed,
        preferNoCommission: parsed.preferNoCommission,
        longTermOnly: parsed.longTermOnly,
      },
    }),
    db.listing.updateMany({ data: { recomputePending: true } }),
  ]);
  if (process.env.NODE_ENV === "production") {
    await inngest.send({
      name: "appscanner/recompute-all.requested",
      data: {},
    });
    revalidatePath("/settings");
    revalidatePath("/listings");
    return { recalculated: 0, queued: true };
  }
  const count = await recomputeAllListings(user.id);
  revalidatePath("/settings");
  revalidatePath("/listings");
  return { recalculated: count };
}

export async function refreshListingAction(listingId: string) {
  await getCurrentUser();
  if (process.env.NODE_ENV === "production") {
    await inngest.send({
      name: "appscanner/refresh-one.requested",
      data: { listingId },
    });
    return { result: "queued" as const };
  }
  const outcome = await refreshSingleListing(listingId);
  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
  return outcome;
}

export async function refreshAllListingsAction() {
  await getCurrentUser();
  if (process.env.NODE_ENV === "production") {
    await inngest.send({ name: "appscanner/refresh-all.requested", data: {} });
    return { queued: true };
  }
  const result = await refreshExistingListings();
  revalidatePath("/listings");
  revalidatePath("/");
  return result;
}

export async function createSavedSearchAction(
  providerName: ProviderName,
  label: string,
  searchUrl: string,
) {
  await getCurrentUser();
  const saved = await createSavedSearch(providerName, label, searchUrl);
  revalidatePath("/settings");
  return { id: saved.id };
}

export async function deleteSavedSearchAction(id: string) {
  await getCurrentUser();
  await deleteSavedSearch(id);
  revalidatePath("/settings");
}

export async function recalculateAllScoresAction() {
  const user = await getCurrentUser();
  if (process.env.NODE_ENV === "production") {
    await inngest.send({
      name: "appscanner/recompute-all.requested",
      data: {},
    });
    return { recalculated: 0, queued: true };
  }
  const count = await recomputeAllListings(user.id);
  revalidatePath("/listings");
  revalidatePath("/");
  return { recalculated: count };
}
