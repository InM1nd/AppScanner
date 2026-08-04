import { describe, expect, it } from "vitest";
import { bestIndexes } from "../compare";

describe("bestIndexes", () => {
  it("marks the cheapest slot", () => {
    expect([...bestIndexes([1159, 1110, 1300], "min")]).toEqual([1]);
  });

  it("marks the highest slot", () => {
    expect([...bestIndexes([33, 35, 12], "max")]).toEqual([1]);
  });

  it("marks every slot tied for the win", () => {
    expect([...bestIndexes([900, 900, 1200], "min")]).toEqual([0, 1]);
  });

  it("marks nothing when fewer than two slots have a value", () => {
    expect(bestIndexes([null, 800, undefined], "min").size).toBe(0);
    expect(bestIndexes([], "max").size).toBe(0);
  });

  it("marks nothing when every present value is identical", () => {
    expect(bestIndexes([800, 800, null], "min").size).toBe(0);
  });

  it("ignores non-finite values", () => {
    expect([...bestIndexes([Number.NaN, 500, 700], "min")]).toEqual([1]);
  });
});
