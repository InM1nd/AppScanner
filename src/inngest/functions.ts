import { inngest } from "./client";
import { getOwnerUser } from "@/server/current-user";
import { notifyViewingReminder, sendDailyDigest } from "@/server/notifications";
import { listCrawlerSavedSearchIds, runSearchCrawler } from "@/server/crawler";
import {
  listRefreshableListingIds,
  refreshSingleListing,
} from "@/server/refresh";
import { recomputeListing } from "@/server/recompute";
import { calculateCommuteForListing } from "@/server/commute";
import { db } from "@/lib/db";

const singleRun = { mode: "skip" as const };

export const dailyDigestJob = inngest.createFunction(
  {
    id: "daily-digest",
    singleton: singleRun,
    triggers: [
      { cron: "TZ=Europe/Vienna 0 8 * * *" },
      { event: "appscanner/digest.requested" },
    ],
  },
  async ({ step }) => {
    if (process.env.NOTIFY_DAILY_DIGEST !== "true") return { skipped: true };
    const user = await step.run("load-owner", getOwnerUser);
    return step.run("send-digest", () => sendDailyDigest(user.id));
  },
);

export const searchCrawlerJob = inngest.createFunction(
  {
    id: "search-crawler",
    singleton: singleRun,
    triggers: [
      { cron: process.env.CRAWLER_CRON ?? "0 */2 * * *" },
      { event: "appscanner/crawler.requested" },
    ],
  },
  async ({ step }) => {
    const ids = await step.run(
      "load-saved-searches",
      listCrawlerSavedSearchIds,
    );
    const results = [];
    for (const id of ids) {
      results.push(await step.run(`crawl-${id}`, () => runSearchCrawler(id)));
    }
    return results;
  },
);

export const refreshListingsJob = inngest.createFunction(
  {
    id: "refresh-listings",
    singleton: singleRun,
    triggers: [
      { cron: process.env.REFRESH_LISTINGS_CRON ?? "30 */3 * * *" },
      { event: "appscanner/refresh-all.requested" },
    ],
  },
  async ({ step }) => {
    const ids = await step.run(
      "load-refreshable-listings",
      listRefreshableListingIds,
    );
    for (let offset = 0; offset < ids.length; offset += 25) {
      for (const id of ids.slice(offset, offset + 25)) {
        await step.run(`refresh-${id}`, () => refreshSingleListing(id));
      }
    }
    return { checked: ids.length };
  },
);

export const refreshListingJob = inngest.createFunction(
  {
    id: "refresh-listing",
    concurrency: { limit: 1, key: "event.data.listingId" },
    triggers: { event: "appscanner/refresh-one.requested" },
  },
  async ({ event, step }) =>
    step.run("refresh-listing", () =>
      refreshSingleListing(String(event.data.listingId)),
    ),
);

export const recomputeListingsJob = inngest.createFunction(
  {
    id: "recompute-listings",
    singleton: { mode: "cancel" },
    triggers: { event: "appscanner/recompute-all.requested" },
  },
  async ({ step }) => {
    const user = await step.run("load-owner", getOwnerUser);
    const ids = await step.run("load-listings", () =>
      db.listing.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    );
    for (let offset = 0; offset < ids.length; offset += 25) {
      for (const { id } of ids.slice(offset, offset + 25)) {
        await step.run(`recompute-${id}`, () => recomputeListing(id, user.id));
      }
    }
    return { recomputed: ids.length };
  },
);

export const recoverPendingRecomputesJob = inngest.createFunction(
  {
    id: "recover-pending-recomputes",
    singleton: singleRun,
    // Every step.run is its own function invocation, so an empty run of a
    // frequent cron is pure billed overhead. Owner + pending listings load
    // in ONE step, and the interval is env-tunable — this is a backstop for
    // recomputePending, not a latency path.
    triggers: { cron: process.env.RECOVER_RECOMPUTES_CRON ?? "*/30 * * * *" },
  },
  async ({ step }) => {
    const { userId, ids } = await step.run(
      "load-pending-listings",
      async () => {
        const user = await getOwnerUser();
        const rows = await db.listing.findMany({
          where: { recomputePending: true },
          select: { id: true },
          orderBy: { id: "asc" },
          take: 100,
        });
        return { userId: user.id, ids: rows.map((row) => row.id) };
      },
    );
    for (const id of ids) {
      await step.run(`recover-${id}`, () => recomputeListing(id, userId));
    }
    return { recovered: ids.length };
  },
);

export const recalculateCommutesJob = inngest.createFunction(
  {
    id: "recalculate-commutes",
    singleton: singleRun,
    triggers: { event: "appscanner/commute-all.requested" },
  },
  async ({ step }) => {
    const ids = await step.run("load-routable-listings", () =>
      db.listing.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
    );
    for (let offset = 0; offset < ids.length; offset += 25) {
      await step.sendEvent(
        `queue-commutes-${offset}`,
        ids.slice(offset, offset + 25).map(({ id }) => ({
          name: "appscanner/commute-one.requested",
          data: { listingId: id },
        })),
      );
    }
    return { total: ids.length, queued: ids.length };
  },
);

export const calculateCommuteJob = inngest.createFunction(
  {
    id: "calculate-commute",
    concurrency: { limit: 1, key: "event.data.listingId" },
    triggers: { event: "appscanner/commute-one.requested" },
  },
  async ({ event, step }) => {
    const user = await step.run("load-owner", getOwnerUser);
    return step.run("calculate-commute", () =>
      calculateCommuteForListing(String(event.data.listingId), user.id),
    );
  },
);

export const viewingRemindersJob = inngest.createFunction(
  {
    id: "viewing-reminders",
    singleton: singleRun,
    triggers: { cron: process.env.VIEWING_REMINDERS_CRON ?? "*/15 * * * *" },
  },
  async ({ step }) => {
    // Single step for the same reason as recover-pending-recomputes: an
    // empty run should cost as few invocations as possible.
    const { userId, listingIds } = await step.run(
      "load-due-viewings",
      async () => {
        const user = await getOwnerUser();
        const due = await db.watchlistItem.findMany({
          where: {
            userId: user.id,
            scheduledViewingAt: {
              gte: new Date(Date.now() - 15 * 60 * 1000),
              lte: new Date(Date.now() + 2 * 60 * 60 * 1000),
            },
          },
          select: { listingId: true },
        });
        return { userId: user.id, listingIds: due.map((d) => d.listingId) };
      },
    );
    for (const listingId of listingIds) {
      await step.run(`remind-${listingId}`, () =>
        notifyViewingReminder(userId, listingId),
      );
    }
    return { checked: listingIds.length };
  },
);

export const inngestFunctions = [
  dailyDigestJob,
  searchCrawlerJob,
  refreshListingsJob,
  refreshListingJob,
  recomputeListingsJob,
  recoverPendingRecomputesJob,
  recalculateCommutesJob,
  calculateCommuteJob,
  viewingRemindersJob,
];
