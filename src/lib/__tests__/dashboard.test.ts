import { describe, expect, it } from "vitest";
import { getTopMatches } from "@/lib/dashboard";

function listing(
  totalScore: number,
  options: { status?: string; isZeroed?: boolean } = {},
) {
  return {
    id: String(totalScore),
    status: options.status ?? "NEW",
    scoreBreakdown: {
      totalScore,
      isZeroed: options.isZeroed ?? false,
    },
  };
}

describe("getTopMatches", () => {
  it("returns the five highest active scores without a hidden score threshold", () => {
    const matches = getTopMatches([
      listing(45),
      listing(90),
      listing(65),
      listing(80),
      listing(75),
      listing(70),
      listing(99, { status: "REJECTED" }),
      listing(98, { isZeroed: true }),
    ]);

    expect(matches.map((item) => item.scoreBreakdown.totalScore)).toEqual([
      90, 80, 75, 70, 65,
    ]);
  });
});
