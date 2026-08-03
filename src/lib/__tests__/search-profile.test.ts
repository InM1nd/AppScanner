import { describe, expect, it } from "vitest";
import {
  defaultScoringWeights,
  scoringWeights,
  searchProfile,
} from "@/types/search-profile";

describe("search profile validation", () => {
  it("accepts the default 100-point weight contract", () => {
    expect(scoringWeights.parse(defaultScoringWeights)).toEqual(
      defaultScoringWeights,
    );
  });

  it("rejects negative or non-100 weight sets", () => {
    expect(() =>
      scoringWeights.parse({
        ...defaultScoringWeights,
        budget: -1,
        commute: 51,
      }),
    ).toThrow();
    expect(() =>
      scoringWeights.parse({ ...defaultScoringWeights, budget: 24 }),
    ).toThrow();
  });

  it("validates cross-field money and move-in ranges", () => {
    const base = {
      moveInEarliest: "2026-09-15",
      moveInLatest: "2026-10-01",
    };
    expect(searchProfile.safeParse(base).success).toBe(true);
    expect(
      searchProfile.safeParse({
        ...base,
        targetMonthlyMin: 1200,
        targetMonthlyMax: 1000,
      }).success,
    ).toBe(false);
    expect(
      searchProfile.safeParse({
        ...base,
        targetMonthlyMax: 1200,
        absoluteMonthlyMax: 1100,
      }).success,
    ).toBe(false);
    expect(
      searchProfile.safeParse({ ...base, moveInEarliest: "2026-10-02" })
        .success,
    ).toBe(false);
  });

  it("V16 defaults profile cost estimates and rejects negative values", () => {
    const parsed = searchProfile.parse({
      moveInEarliest: "2026-09-15",
      moveInLatest: "2026-10-01",
    });

    expect(parsed.energyMonthlyEstimate).toBe(130);
    expect(parsed.internetMonthlyEstimate).toBe(30);
    expect(searchProfile.safeParse({ energyMonthlyEstimate: -1 }).success).toBe(
      false,
    );
    expect(
      searchProfile.safeParse({ internetMonthlyEstimate: -1 }).success,
    ).toBe(false);
  });
});
