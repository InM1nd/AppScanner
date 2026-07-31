// Loads fixtures/sample-listings.json through the real import pipeline.
// Usage: npx tsx scripts/import-fixture.ts

import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { getCurrentUser } from "../src/server/current-user";
import { saveManualListing } from "../src/server/import";
import { normalizedListing } from "../src/types/listing";

async function main() {
  const file = path.join(__dirname, "..", "fixtures", "sample-listings.json");
  const raw = JSON.parse(readFileSync(file, "utf-8"));
  const user = await getCurrentUser();

  for (const entry of raw.listings) {
    const draft = normalizedListing.parse(entry);
    try {
      const listing = await saveManualListing(user.id, draft, true);
      console.log(`+ ${listing.title}`);
    } catch (error) {
      console.warn(
        `! skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
