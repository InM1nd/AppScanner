// listRefreshableListingIds() decides how many Inngest invocations the
// refresh-listings cron spends per run (one per id it returns), so its
// predicates are a cost control, not just a correctness detail. All of it is
// a Prisma query — nothing a DB-free unit test can reach.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  blankNormalizedListing,
  exactFact,
  type NormalizedListing,
} from "@/types/listing";
import { createListingFromDraft } from "./listings";
import { getOwnerUser } from "./current-user";
import { listRefreshableListingIds } from "./refresh";

const run = `refresh-integration-${Date.now()}`;
const createdIds: string[] = [];

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

function draft(suffix: string): NormalizedListing {
  return {
    ...blankNormalizedListing,
    title: `${run}-${suffix}`,
    canonicalUrl: `https://example.com/${run}/${suffix}`,
    sourceListingId: `${run}-${suffix}`,
    importMethod: "URL_METADATA",
    listingType: "RENTAL",
    city: "Wien",
    address: `${run} Testgasse 1, 1010 Wien`,
    district: 1,
    rooms: 2,
    squareMeters: 55,
    baseRent: exactFact(900, "fixture"),
  };
}

async function fixture(
  suffix: string,
  data: {
    lastSourceCheckedAt: Date | null;
    sourceAvailability: "ACTIVE" | "RESERVED" | "GONE";
  },
): Promise<string> {
  // GENERIC_URL is in REAL_FETCH_PROVIDERS, so the provider predicate isn't
  // what's doing the filtering in these cases.
  const { id } = await createListingFromDraft({
    providerName: "GENERIC_URL",
    draft: draft(suffix),
  });
  createdIds.push(id);
  await db.listing.update({ where: { id }, data });
  return id;
}

describe("listRefreshableListingIds", () => {
  let goneId: string;
  let reservedId: string;
  let freshId: string;
  let staleId: string;
  let neverCheckedId: string;

  beforeAll(async () => {
    await getOwnerUser();
    process.env.REFRESH_MIN_AGE_HOURS = "12";
    // The dev DB holds unrelated listings; keep the cap out of the way so
    // these assertions are about the predicates, not about batch position.
    process.env.REFRESH_BATCH_SIZE = "100000";

    goneId = await fixture("gone", {
      sourceAvailability: "GONE",
      lastSourceCheckedAt: ago(500),
    });
    reservedId = await fixture("reserved", {
      sourceAvailability: "RESERVED",
      lastSourceCheckedAt: ago(400),
    });
    freshId = await fixture("fresh", {
      sourceAvailability: "ACTIVE",
      lastSourceCheckedAt: ago(1),
    });
    staleId = await fixture("stale", {
      sourceAvailability: "ACTIVE",
      lastSourceCheckedAt: ago(30),
    });
    neverCheckedId = await fixture("never-checked", {
      sourceAvailability: "ACTIVE",
      lastSourceCheckedAt: null,
    });
  });

  afterAll(async () => {
    await db.listing.deleteMany({ where: { id: { in: createdIds } } });
    await db.$disconnect();
  });

  it("excludes GONE listings however overdue they are", async () => {
    expect(await listRefreshableListingIds()).not.toContain(goneId);
  });

  it("keeps checking RESERVED listings — a reservation can fall through", async () => {
    expect(await listRefreshableListingIds()).toContain(reservedId);
  });

  it("excludes listings checked inside REFRESH_MIN_AGE_HOURS", async () => {
    const ids = await listRefreshableListingIds();
    expect(ids).not.toContain(freshId);
    expect(ids).toContain(staleId);
  });

  it("includes never-checked listings", async () => {
    expect(await listRefreshableListingIds()).toContain(neverCheckedId);
  });

  it("orders oldest-checked first so a capped batch round-robins", async () => {
    const ids = await listRefreshableListingIds();
    const mine = ids.filter((id) => createdIds.includes(id));
    // null (never checked) is most urgent, then 400h, then 30h.
    expect(mine).toEqual([neverCheckedId, reservedId, staleId]);
  });

  it("honors REFRESH_BATCH_SIZE", async () => {
    process.env.REFRESH_BATCH_SIZE = "3";
    try {
      expect(await listRefreshableListingIds()).toHaveLength(3);
    } finally {
      process.env.REFRESH_BATCH_SIZE = "100000";
    }
  });
});
