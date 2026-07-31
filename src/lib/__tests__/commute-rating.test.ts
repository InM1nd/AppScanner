import { describe, expect, it } from "vitest";
import { classifyCommuteRating } from "@/lib/commute/rating";

describe("classifyCommuteRating", () => {
  it("rates up to two-thirds of the profile maximum as excellent", () => {
    expect(classifyCommuteRating(1)).toBe("EXCELLENT");
    expect(classifyCommuteRating(20)).toBe("EXCELLENT");
  });
  it("rates 21-30 minutes as acceptable", () => {
    expect(classifyCommuteRating(21)).toBe("ACCEPTABLE");
    expect(classifyCommuteRating(30)).toBe("ACCEPTABLE");
  });
  it("rates 31-35 minutes as warning", () => {
    expect(classifyCommuteRating(31)).toBe("WARNING");
    expect(classifyCommuteRating(35)).toBe("WARNING");
  });
  it("rates over 35 minutes as poor", () => {
    expect(classifyCommuteRating(36)).toBe("POOR");
  });

  it("scales thresholds relative to maxCommuteMinutes", () => {
    expect(classifyCommuteRating(40, 60)).toBe("EXCELLENT");
    expect(classifyCommuteRating(60, 60)).toBe("ACCEPTABLE");
    expect(classifyCommuteRating(70, 60)).toBe("WARNING");
    expect(classifyCommuteRating(71, 60)).toBe("POOR");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid duration %s",
    (duration) => {
      expect(() => classifyCommuteRating(duration)).toThrow(RangeError);
    },
  );
});
