import { describe, expect, it } from "vitest";
import { detectAmenitySignal, parseEuroAmount } from "./text-signals";

describe("parseEuroAmount", () => {
  it("V14 distinguishes Austrian thousands groups from decimal forms", () => {
    expect(parseEuroAmount("2.850")).toBe(2850);
    expect(parseEuroAmount("4.878,69 €")).toBe(4878.69);
    expect(parseEuroAmount("386,03")).toBe(386.03);
    expect(parseEuroAmount("12.50")).toBe(12.5);
  });
});

describe("detectAmenitySignal", () => {
  it("V12 keeps explicit amenity negation from becoming a positive", () => {
    expect(
      detectAmenitySignal("No elevator in the building", ["elevator"]),
    ).toBe("NO");
    expect(detectAmenitySignal("Wohnung ohne Balkon", ["balkon"])).toBe("NO");
  });
});
