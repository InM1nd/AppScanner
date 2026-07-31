import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  blankNormalizedListing,
  exactFact,
  unknownFact,
  type NormalizedListing,
} from "@/types/listing";
import { createListingFromDraft, DuplicateListingError } from "./listings";
import { getOwnerUser } from "./current-user";
import { recomputeListing } from "./recompute";
import { sendDailyDigest } from "./notifications";

const run = `integration-${Date.now()}`;
const createdIds: string[] = [];

function draft(
  suffix: string,
  overrides: Partial<NormalizedListing> = {},
): NormalizedListing {
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
    operatingCosts: exactFact(150, "fixture"),
    heatingCost: exactFact(50, "fixture"),
    hotWaterCost: exactFact(20, "fixture"),
    electricityEstimate: exactFact(40, "fixture"),
    internetEstimate: exactFact(30, "fixture"),
    deposit: unknownFact,
    ...overrides,
  };
}

describe("V15 listing persistence contract", () => {
  beforeAll(async () => void (await getOwnerUser()));
  afterAll(async () => {
    await db.listing.deleteMany({ where: { id: { in: createdIds } } });
    await db.$disconnect();
  });

  it("creates one listing for concurrent exact imports", async () => {
    const input = draft("concurrent");
    const results = await Promise.allSettled([
      createListingFromDraft({ providerName: "GENERIC_URL", draft: input }),
      createListingFromDraft({ providerName: "GENERIC_URL", draft: input }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      DuplicateListingError,
    );
    const id = (fulfilled[0] as PromiseFulfilledResult<{ id: string }>).value
      .id;
    createdIds.push(id);
    const row = await db.listing.findUniqueOrThrow({
      where: { id },
      include: { snapshots: true, scoreBreakdown: true },
    });
    expect(row.snapshots).toHaveLength(1);
    expect(row.scoreBreakdown?.totalScore).toBeGreaterThanOrEqual(0);
    expect(row.recomputePending).toBe(false);
  });

  it("attaches third fuzzy duplicate to the existing cluster", async () => {
    const first = await createListingFromDraft({
      providerName: "GENERIC_URL",
      draft: draft("cluster-a"),
    });
    const [second, third] = await Promise.all([
      createListingFromDraft({
        providerName: "GENERIC_URL",
        draft: draft("cluster-b"),
      }),
      createListingFromDraft({
        providerName: "GENERIC_URL",
        draft: draft("cluster-c"),
      }),
    ]);
    createdIds.push(first.id, second.id, third.id);
    const rows = await db.listing.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: { duplicateClusterId: true },
    });
    expect(new Set(rows.map((row) => row.duplicateClusterId))).toEqual(
      new Set([rows[0].duplicateClusterId]),
    );
    expect(rows[0].duplicateClusterId).not.toBeNull();
  });

  it("ignores a commute route whose coordinates do not match the profile", async () => {
    const listing = await createListingFromDraft({
      providerName: "GENERIC_URL",
      draft: draft("stale-route", { latitude: 48.2, longitude: 16.3 }),
    });
    createdIds.push(listing.id);
    await db.commuteEstimate.create({
      data: {
        listingId: listing.id,
        provider: "google",
        originLat: 1,
        originLng: 1,
        destLat: 1,
        destLng: 1,
        durationMinutes: 1,
        rating: "EXCELLENT",
      },
    });
    await recomputeListing(listing.id);
    const score = await db.scoreBreakdown.findUniqueOrThrow({
      where: { listingId: listing.id },
    });
    const commute = (
      score.categories as Array<{ key: string; points: number }>
    ).find((category) => category.key === "commute");
    expect(commute?.points).toBe(0);
  });

  it("deduplicates 20 concurrent digest sends before Telegram", async () => {
    const user = await getOwnerUser();
    const previous = {
      enabled: process.env.TELEGRAM_ENABLED,
      token: process.env.TELEGRAM_BOT_TOKEN,
      chat: process.env.TELEGRAM_CHAT_ID,
    };
    process.env.TELEGRAM_ENABLED = "true";
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await Promise.all(
        Array.from({ length: 20 }, () => sendDailyDigest(user.id)),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const logs = await db.notificationLog.findMany({
        where: { userId: user.id, type: "DAILY_DIGEST" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe("SENT");
      await db.notificationLog.delete({ where: { id: logs[0].id } });
    } finally {
      process.env.TELEGRAM_ENABLED = previous.enabled;
      process.env.TELEGRAM_BOT_TOKEN = previous.token;
      process.env.TELEGRAM_CHAT_ID = previous.chat;
      vi.unstubAllGlobals();
    }
  });
});
