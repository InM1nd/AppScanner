import { db } from "@/lib/db";
import { detectProviderForUrl, getProviderAdapter } from "@/providers";
import type { ProviderName } from "@/types/enums";
import {
  blankNormalizedListing,
  type NormalizedListing,
} from "@/types/listing";
import { createListingFromDraft, DuplicateListingError } from "./listings";

async function getOrCreateProviderRow(name: ProviderName) {
  return db.provider.upsert({
    where: { name },
    update: {},
    create: { name, displayName: name },
  });
}

export async function startUrlImportJob(userId: string, url: string) {
  const providerName = detectProviderForUrl(url);
  const provider = await getOrCreateProviderRow(providerName);
  const job = await db.importJob.create({
    data: {
      userId,
      providerId: provider.id,
      method: "URL_METADATA",
      inputUrl: url,
      status: "PENDING",
    },
  });

  const adapter = getProviderAdapter(providerName);
  try {
    if (!provider.isEnabled)
      throw new Error(`Provider ${providerName} is disabled.`);
    if (!adapter)
      throw new Error(`No adapter registered for provider ${providerName}.`);
    const draft = await adapter.importFromUrl(url);
    await db.provider.update({
      where: { id: provider.id },
      data: {
        healthStatus: "OK",
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
    });
    return db.importJob.update({
      where: { id: job.id },
      data: { status: "NEEDS_REVIEW", rawParsed: draft },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown import error.";
    await db.provider.update({
      where: { id: provider.id },
      data: {
        healthStatus: "DEGRADED",
        lastHealthCheckAt: new Date(),
        lastError: message.slice(0, 1000),
      },
    });
    return db.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message },
    });
  }
}

export async function startEmailImportJob(
  userId: string,
  providerName: ProviderName,
  rawEmail: string,
) {
  const provider = await getOrCreateProviderRow(providerName);
  const job = await db.importJob.create({
    data: {
      userId,
      providerId: provider.id,
      method: "EMAIL_ALERT",
      inputEmailRaw: rawEmail,
      status: "PENDING",
    },
  });

  const adapter = getProviderAdapter(providerName);
  try {
    if (!provider.isEnabled)
      throw new Error(`Provider ${providerName} is disabled.`);
    if (!adapter?.parseEmailAlert)
      throw new Error(
        `Provider ${providerName} does not support email alert parsing.`,
      );
    const drafts = await adapter.parseEmailAlert(rawEmail);
    await db.provider.update({
      where: { id: provider.id },
      data: {
        healthStatus: "OK",
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
    });
    return db.importJob.update({
      where: { id: job.id },
      data: {
        status: drafts.length > 0 ? "NEEDS_REVIEW" : "FAILED",
        rawParsed: drafts,
        errorMessage:
          drafts.length === 0
            ? "No listing URLs found in the pasted email."
            : null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown import error.";
    await db.provider.update({
      where: { id: provider.id },
      data: {
        healthStatus: "DEGRADED",
        lastHealthCheckAt: new Date(),
        lastError: message.slice(0, 1000),
      },
    });
    return db.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message },
    });
  }
}

export function blankManualDraft(): NormalizedListing {
  return { ...blankNormalizedListing, importMethod: "MANUAL" };
}

export async function finalizeImportJob(
  jobId: string,
  correctedDraft: NormalizedListing,
  allowExactDuplicate = false,
) {
  const job = await db.importJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { provider: true },
  });
  const providerName = (job.provider?.name ?? "MANUAL") as ProviderName;
  const draft = { ...correctedDraft, importMethod: job.method };

  try {
    const listing = await createListingFromDraft({
      providerName,
      draft,
      allowExactDuplicate,
    });
    await db.importJob.update({
      where: { id: jobId },
      data: { status: "SAVED", resultListingId: listing.id },
    });
    return listing;
  } catch (error) {
    if (error instanceof DuplicateListingError) {
      await db.importJob.update({
        where: { id: jobId },
        data: { status: "DUPLICATE", errorMessage: error.message },
      });
    }
    throw error;
  }
}

export async function saveManualListing(
  userId: string,
  draft: NormalizedListing,
  allowExactDuplicate = false,
) {
  const provider = await getOrCreateProviderRow("MANUAL");
  const job = await db.importJob.create({
    data: {
      userId,
      providerId: provider.id,
      method: "MANUAL",
      status: "NEEDS_REVIEW",
      rawParsed: draft,
    },
  });
  return finalizeImportJob(job.id, draft, allowExactDuplicate);
}
