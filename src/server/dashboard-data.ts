// Dashboard aggregates, computed with targeted queries (count/aggregate/
// groupBy, narrow where clauses) instead of pulling every Listing row and
// reducing in JS — see AGENTS.md-adjacent discussion: listAllListings() with
// no where/limit was the single most-hit full-table-scan in the app, since
// this page runs it on every visit. Each derived value below mirrors the
// exact predicate the old JS filter used, pushed into the query.

import { db } from "@/lib/db";
import { daysAgo } from "@/lib/time";
import { toNum } from "./decimal";
import { LISTING_CARD_INCLUDE, type ListingCard } from "./queries";

const INACTIVE_STATUSES = ["REJECTED", "ARCHIVED"] as const;

function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export interface DashboardData {
  newListings: ListingCard[];
  topMatches: ListingCard[];
  urgent: ListingCard[];
  activeCount: number;
  shortlistedCount: number;
  avgKnownCost: number | null;
  avgScore: number | null;
  importsByDay: { date: string; count: number }[];
  districtCosts: { district: string; avgCost: number }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const threeDaysAgo = daysAgo(3);
  const fourteenDayWindowStart = utcDayStart(daysAgo(13));

  const [
    newListings,
    topMatches,
    urgent,
    activeCount,
    shortlistedCount,
    costAgg,
    recentImports,
    districtGroups,
  ] = await Promise.all([
    db.listing.findMany({
      where: {
        importedAt: { gte: threeDaysAgo },
        status: { notIn: [...INACTIVE_STATUSES] },
      },
      include: LISTING_CARD_INCLUDE,
      orderBy: { importedAt: "desc" },
    }),
    db.listing.findMany({
      where: {
        status: { notIn: [...INACTIVE_STATUSES] },
        scoreBreakdown: { isZeroed: false },
      },
      include: LISTING_CARD_INCLUDE,
      orderBy: [
        { scoreBreakdown: { totalScore: "desc" } },
        { importedAt: "desc" },
      ],
      take: 5,
    }),
    db.listing.findMany({
      where: {
        status: { notIn: [...INACTIVE_STATUSES] },
        OR: [
          {
            status: "NEW",
            scoreBreakdown: {
              totalScore: { gte: 70 },
              dataCompleteness: { gte: 70 },
              isZeroed: false,
            },
          },
          { status: "NEW", importedAt: { lt: threeDaysAgo } },
          {
            scoreBreakdown: {
              totalScore: { gte: 70 },
              dataCompleteness: { gte: 70 },
              isZeroed: false,
            },
            costRedFlags: { has: "NO_AVAILABILITY_DATE" },
          },
        ],
      },
      include: LISTING_CARD_INCLUDE,
    }),
    db.listing.count({ where: { status: { notIn: [...INACTIVE_STATUSES] } } }),
    db.listing.count({ where: { status: "SHORTLISTED" } }),
    db.listing.aggregate({ _sum: { monthlyLikelyTotal: true }, _count: true }),
    db.listing.findMany({
      where: { importedAt: { gte: fourteenDayWindowStart } },
      select: { importedAt: true },
    }),
    db.listing.groupBy({
      by: ["district"],
      where: { district: { not: null }, monthlyLikelyTotal: { not: null } },
      _avg: { monthlyLikelyTotal: true },
    }),
  ]);

  const avgKnownCost =
    costAgg._count > 0
      ? Math.round((toNum(costAgg._sum.monthlyLikelyTotal) ?? 0) / costAgg._count)
      : null;
  const avgScore = topMatches.length
    ? Math.round(
        topMatches.reduce(
          (sum, l) => sum + (l.scoreBreakdown?.totalScore ?? 0),
          0,
        ) / topMatches.length,
      )
    : null;

  const importsByDay = Array.from({ length: 14 }, (_, i) => {
    const day = daysAgo(13 - i);
    const key = day.toISOString().slice(0, 10);
    const count = recentImports.filter(
      (l) => l.importedAt.toISOString().slice(0, 10) === key,
    ).length;
    return { date: key.slice(5), count };
  });

  const districtCosts = districtGroups
    .filter((g): g is typeof g & { district: number } => g.district !== null)
    .sort((a, b) => a.district - b.district)
    .map((g) => ({
      district: String(g.district),
      avgCost: Math.round(toNum(g._avg.monthlyLikelyTotal) ?? 0),
    }));

  return {
    newListings,
    topMatches,
    urgent,
    activeCount,
    shortlistedCount,
    avgKnownCost,
    avgScore,
    importsByDay,
    districtCosts,
  };
}
