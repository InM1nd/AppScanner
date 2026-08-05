import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    listing: {
      findMany: mocks.findMany,
      count: mocks.count,
      aggregate: mocks.aggregate,
      groupBy: mocks.groupBy,
    },
  },
}));

import { getDashboardData } from "./dashboard-data";

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    status: "NEW",
    importedAt: new Date(),
    ...overrides,
  };
}

describe("getDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Call order inside Promise.all: newListings, topMatches, urgent, [counts,
    // aggregate], recentImports, groupBy.
    mocks.findMany
      .mockResolvedValueOnce([listing({ id: "new-1" })]) // newListings
      .mockResolvedValueOnce([
        listing({
          id: "top-1",
          scoreBreakdown: { totalScore: 90, isZeroed: false },
        }),
        listing({
          id: "top-2",
          scoreBreakdown: { totalScore: 80, isZeroed: false },
        }),
      ]) // topMatches
      .mockResolvedValueOnce([listing({ id: "urgent-1" })]) // urgent
      .mockResolvedValueOnce([
        { importedAt: new Date() },
        { importedAt: new Date() },
      ]); // recentImports
    mocks.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
    mocks.aggregate.mockResolvedValue({
      _sum: { monthlyLikelyTotal: 2400 },
      _count: 12,
    });
    mocks.groupBy.mockResolvedValue([
      { district: 15, _avg: { monthlyLikelyTotal: 1100 } },
      { district: 16, _avg: { monthlyLikelyTotal: 900 } },
    ]);
  });

  it("wires each query's result to the matching field, in the order Promise.all resolves them", async () => {
    const data = await getDashboardData();

    expect(data.newListings.map((l) => l.id)).toEqual(["new-1"]);
    expect(data.topMatches.map((l) => l.id)).toEqual(["top-1", "top-2"]);
    expect(data.urgent.map((l) => l.id)).toEqual(["urgent-1"]);
    expect(data.activeCount).toBe(12);
    expect(data.shortlistedCount).toBe(3);
  });

  it("computes avgKnownCost from the aggregate sum/count, not the fetched rows", async () => {
    const data = await getDashboardData();
    expect(data.avgKnownCost).toBe(200); // 2400 / 12
  });

  it("computes avgScore from topMatches only", async () => {
    const data = await getDashboardData();
    expect(data.avgScore).toBe(85); // (90 + 80) / 2
  });

  it("returns null avgKnownCost/avgScore when there is nothing to average", async () => {
    mocks.aggregate.mockReset();
    mocks.aggregate.mockResolvedValue({
      _sum: { monthlyLikelyTotal: null },
      _count: 0,
    });
    mocks.findMany.mockReset();
    mocks.findMany
      .mockResolvedValueOnce([]) // newListings
      .mockResolvedValueOnce([]) // topMatches
      .mockResolvedValueOnce([]) // urgent
      .mockResolvedValueOnce([]); // recentImports

    const data = await getDashboardData();
    expect(data.avgKnownCost).toBeNull();
    expect(data.avgScore).toBeNull();
  });

  it("buckets recentImports into a 14-day series by UTC calendar date", async () => {
    const data = await getDashboardData();
    expect(data.importsByDay).toHaveLength(14);
    const total = data.importsByDay.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(2);
  });

  it("maps and rounds districtGroups, sorted by district number", async () => {
    const data = await getDashboardData();
    expect(data.districtCosts).toEqual([
      { district: "15", avgCost: 1100 },
      { district: "16", avgCost: 900 },
    ]);
  });

  it("excludes REJECTED/ARCHIVED from newListings/topMatches/activeCount queries", async () => {
    await getDashboardData();
    const [newListingsArgs, topMatchesArgs] = mocks.findMany.mock.calls;
    expect(newListingsArgs[0].where.status).toEqual({
      notIn: ["REJECTED", "ARCHIVED"],
    });
    expect(topMatchesArgs[0].where.status).toEqual({
      notIn: ["REJECTED", "ARCHIVED"],
    });
    expect(mocks.count.mock.calls[0][0].where.status).toEqual({
      notIn: ["REJECTED", "ARCHIVED"],
    });
  });
});
