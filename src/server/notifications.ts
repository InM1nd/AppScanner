import { db } from "@/lib/db";
import { sendTelegramMessage, isTelegramConfigured } from "@/lib/telegram";
import { formatEur } from "@/lib/format";
import type { NotificationType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { toNum } from "./decimal";

const GLOBAL_DAILY_CAP = 30;
// Same listing/type pair won't be re-sent within this window even if re-triggered.
const DEDUPE_WINDOW_HOURS = 24;

const RED_FLAG_LABELS: Record<string, string> = {
  OVER_ABSOLUTE_MAX: "over budget max",
  HEATING_UNCLEAR: "heating cost unclear",
  ELECTRICITY_UNCLEAR: "electricity cost unclear",
  PARKING_SEPARATE_COST: "parking is a separate cost",
  COMMISSION_OR_CONTRACT_FEE: "commission/contract fee charged",
  HIGH_DEPOSIT: "deposit exceeds 3 months' rent",
  NO_AVAILABILITY_DATE: "no availability date",
};

async function withinRateLimit(
  userId: string,
  type: NotificationType,
  listingId?: string,
): Promise<boolean> {
  if (type === "TELEGRAM_TEST") return true;
  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const globalToday = await db.notificationLog.count({
    where: {
      userId,
      type: { not: "TELEGRAM_TEST" },
      status: "SENT",
      createdAt: { gte: todayStart },
    },
  });
  if (globalToday >= GLOBAL_DAILY_CAP) return false;

  if (listingId) {
    const dup = await db.notificationLog.findFirst({
      where: {
        userId,
        listingId,
        type,
        status: "SENT",
        createdAt: { gte: since },
      },
    });
    if (dup) return false;
  }
  return true;
}

async function dispatch(
  userId: string,
  type: NotificationType,
  text: string,
  dedupeKey: string,
  listingId?: string,
) {
  const payload = { text };

  let log: { id: string };
  try {
    log = await db.notificationLog.create({
      data: {
        userId,
        listingId,
        dedupeKey,
        channel: "TELEGRAM",
        type,
        payload,
        status: "PENDING",
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.notificationLog.findUniqueOrThrow({
        where: { dedupeKey },
        select: { id: true },
      });
      const claimed = await db.notificationLog.updateMany({
        where: {
          id: existing.id,
          OR: [
            { status: "FAILED" },
            {
              status: "PENDING",
              updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
            },
          ],
        },
        data: { status: "PENDING", errorMessage: null },
      });
      if (claimed.count === 0)
        return { sent: false, reason: "deduplicated" as const };
      log = existing;
    } else {
      throw error;
    }
  }

  if (!(await withinRateLimit(userId, type, listingId))) {
    await db.notificationLog.update({
      where: { id: log.id },
      data: { status: "RATE_LIMITED" },
    });
    return { sent: false, reason: "rate_limited" as const };
  }

  if (!isTelegramConfigured()) {
    await db.notificationLog.update({
      where: { id: log.id },
      data: { status: "SKIPPED", errorMessage: "Telegram not configured." },
    });
    return { sent: false, reason: "not_configured" as const };
  }

  const result = await sendTelegramMessage(
    process.env.TELEGRAM_BOT_TOKEN!,
    process.env.TELEGRAM_CHAT_ID!,
    text,
  );
  await db.notificationLog.update({
    where: { id: log.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      errorMessage: result.error,
      sentAt: result.ok ? new Date() : null,
    },
  });
  if (!result.ok) throw new Error(result.error ?? "Telegram delivery failed.");
  return {
    sent: result.ok,
    reason: result.ok ? ("sent" as const) : ("failed" as const),
    error: result.error,
  };
}

function keyRedFlag(redFlags: string[]): string {
  if (redFlags.length === 0) return "None flagged.";
  return RED_FLAG_LABELS[redFlags[0]] ?? redFlags[0];
}

export async function notifyNewHighScore(userId: string, listingId: string) {
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { scoreBreakdown: true, provider: true },
  });
  const score = listing.scoreBreakdown?.totalScore ?? 0;
  const completeness = listing.scoreBreakdown?.dataCompleteness ?? 0;
  if (
    listing.status === "REJECTED" ||
    listing.status === "ARCHIVED" ||
    listing.sourceAvailability === "RESERVED" ||
    listing.sourceAvailability === "GONE"
  )
    return { sent: false, reason: "not_actionable" as const };
  if (score < 70 || completeness < 70 || listing.scoreBreakdown?.isZeroed)
    return { sent: false, reason: "below_threshold" as const };

  const commute = await db.commuteEstimate.findFirst({
    where: { listingId },
    orderBy: { calculatedAt: "desc" },
  });
  const text =
    `New strong match (${score}/100, ${completeness}% complete)\n` +
    `${listing.title}\n` +
    `Source: ${listing.provider.displayName}\n` +
    `Likely all-in monthly total: ${formatEur(toNum(listing.monthlyLikelyTotal))}\n` +
    `Commute: ${commute ? `${commute.durationMinutes} min` : "not calculated"}\n` +
    `Key flag: ${keyRedFlag(listing.costRedFlags)}\n` +
    listing.canonicalUrl;

  return dispatch(
    userId,
    "NEW_HIGH_SCORE",
    text,
    `high-score:${listingId}`,
    listingId,
  );
}

export async function notifyPriceDrop(
  userId: string,
  listingId: string,
  oldAmount: number,
  newAmount: number,
) {
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { scoreBreakdown: true, provider: true },
  });
  const text =
    `Price drop on a watched listing\n` +
    `${listing.title}\n` +
    `Source: ${listing.provider.displayName}\n` +
    `${formatEur(oldAmount)} → ${formatEur(newAmount)}\n` +
    `Score: ${listing.scoreBreakdown?.totalScore ?? "n/a"}/100\n` +
    listing.canonicalUrl;

  return dispatch(
    userId,
    "PRICE_DROP",
    text,
    `price-drop:${listingId}:${oldAmount.toFixed(2)}:${newAmount.toFixed(2)}`,
    listingId,
  );
}

export async function notifyViewingReminder(userId: string, listingId: string) {
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { provider: true },
  });
  const item = await db.watchlistItem.findUniqueOrThrow({
    where: { userId_listingId: { userId, listingId } },
  });
  const text = `Viewing reminder\n${listing.title}\nSource: ${listing.provider.displayName}\n${listing.canonicalUrl}`;
  return dispatch(
    userId,
    "VIEWING_REMINDER",
    text,
    `viewing:${item.id}:${item.scheduledViewingAt?.toISOString() ?? "unscheduled"}`,
    listingId,
  );
}

export async function notifyUrgency(
  userId: string,
  listingId: string,
  reason: string,
) {
  const listing = await db.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { provider: true },
  });
  const text = `Act soon: ${reason}\n${listing.title}\nSource: ${listing.provider.displayName}\n${listing.canonicalUrl}`;
  return dispatch(
    userId,
    "URGENCY_WARNING",
    text,
    `urgency:${listingId}:${reason}`,
    listingId,
  );
}

export async function sendDailyDigest(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const listings = await db.listing.findMany({
    where: { importedAt: { gte: since } },
    include: { scoreBreakdown: true },
    orderBy: { importedAt: "desc" },
  });
  const degradedProviders = await db.provider.findMany({
    where: { healthStatus: { in: ["DEGRADED", "DOWN"] } },
    select: { displayName: true, healthStatus: true, lastError: true },
  });
  if (listings.length === 0 && degradedProviders.length === 0)
    return { sent: false, reason: "nothing_new" as const };

  const lines = listings
    .slice(0, 15)
    .map(
      (l) =>
        `• ${l.title} — ${l.scoreBreakdown?.totalScore ?? "n/a"}/100 — ${formatEur(toNum(l.monthlyLikelyTotal))}`,
    );
  const providerLines = degradedProviders.map(
    (provider) =>
      `• Source ${provider.displayName}: ${provider.healthStatus}${provider.lastError ? ` — ${provider.lastError}` : ""}`,
  );
  const text = `Daily digest: ${listings.length} new listing(s) in the last 24h\n\n${[...lines, ...providerLines].join("\n")}`;

  const viennaDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return dispatch(
    userId,
    "DAILY_DIGEST",
    text,
    `digest:${userId}:${viennaDay}`,
  );
}

export async function sendTelegramTest(userId: string) {
  return dispatch(
    userId,
    "TELEGRAM_TEST",
    "AppScanner Telegram test message. Notifications are wired up correctly.",
    `telegram-test:${userId}:${crypto.randomUUID()}`,
  );
}
