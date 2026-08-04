import { db } from "../src/lib/db";
import type { ProviderName } from "../src/types/enums";

const providers: { name: ProviderName; displayName: string }[] = [
  { name: "WILLHABEN", displayName: "Willhaben" },
  { name: "IMMOSCOUT24_AT", displayName: "ImmoScout24 Austria" },
  { name: "IMMOWELT_AT", displayName: "ImmoWelt Austria" },
  { name: "DER_STANDARD", displayName: "Der Standard Immobilien" },
  { name: "FINDMYHOME", displayName: "FindMyHome" },
  { name: "LYSTIO", displayName: "Lystio" },
  { name: "GENERIC_URL", displayName: "Generic URL importer" },
  { name: "MANUAL", displayName: "Manual entry" },
];

export async function seedProviders() {
  for (const provider of providers) {
    await db.provider.upsert({
      where: { name: provider.name },
      update: { displayName: provider.displayName },
      create: provider,
    });
  }
}
