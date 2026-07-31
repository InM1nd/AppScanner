import { db } from "@/lib/db";
import { getCurrentUser } from "./current-user";
import type { ProviderName } from "@/types/enums";
import { assertSafePublicUrl } from "@/providers/shared/safe-fetch";

const SEARCH_HOSTS: Partial<Record<ProviderName, readonly string[]>> = {
  WILLHABEN: ["willhaben.at"],
  IMMOSCOUT24_AT: ["immobilienscout24.at"],
  IMMOWELT_AT: ["immowelt.at"],
  DER_STANDARD: ["immobilien.derstandard.at"],
  FINDMYHOME: ["findmyhome.at"],
  LYSTIO: ["lystio.at"],
};

async function getOrCreateProvider(name: ProviderName) {
  return db.provider.upsert({
    where: { name },
    update: {},
    create: { name, displayName: name },
  });
}

export async function listSavedSearches() {
  await getCurrentUser();
  return db.savedSearch.findMany({
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSavedSearch(
  providerName: ProviderName,
  label: string,
  searchUrl: string,
) {
  const allowedHosts = SEARCH_HOSTS[providerName];
  if (!allowedHosts)
    throw new Error("Saved searches require a supported provider domain.");
  const url = await assertSafePublicUrl(searchUrl, { allowedHosts });
  const cleanLabel = label.trim();
  if (!cleanLabel) throw new Error("Saved search label is required.");
  const provider = await getOrCreateProvider(providerName);
  return db.savedSearch.create({
    data: {
      providerId: provider.id,
      label: cleanLabel,
      searchUrl: url.toString(),
    },
  });
}

export async function deleteSavedSearch(id: string) {
  await db.savedSearch.delete({ where: { id } });
}
