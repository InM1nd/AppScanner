interface ScoredDashboardListing {
  status: string;
  scoreBreakdown: {
    totalScore: number;
    isZeroed: boolean;
  } | null;
}

export function getTopMatches<T extends ScoredDashboardListing>(
  listings: readonly T[],
  limit = 5,
): T[] {
  return listings
    .filter(
      (listing) =>
        listing.scoreBreakdown !== null &&
        !listing.scoreBreakdown.isZeroed &&
        !["REJECTED", "ARCHIVED"].includes(listing.status),
    )
    .sort(
      (a, b) =>
        (b.scoreBreakdown?.totalScore ?? 0) -
        (a.scoreBreakdown?.totalScore ?? 0),
    )
    .slice(0, limit);
}
