import { describe, expect, it } from "vitest";
import { computeCost } from "@/lib/cost";
import {
  computeScore,
  isViennaLocation,
  type CommuteInput,
  type ScoreListingInput,
  type ScoreProfileInput,
} from "@/lib/score";
import { defaultScoringWeights } from "@/types/search-profile";
import { estimateFact, exactFact, unknownFact } from "@/types/listing";

const profile: ScoreProfileInput = {
  preferredDistricts: [14, 15, 16],
  secondaryDistricts: [6, 7, 10, 11, 12],
  maxCommuteMinutes: 30,
  requireSeparateBedroom: true,
  minRooms: 2,
  targetMonthlyMax: 1000,
  absoluteMonthlyMax: 1100,
  moveInEarliest: new Date("2026-09-15"),
  moveInLatest: new Date("2026-10-01"),
  needsFittedKitchen: true,
  needsWashingMachine: true,
  parkingRequired: false,
  preferNoCommission: true,
  longTermOnly: true,
  weights: defaultScoringWeights,
};

function goodListing(
  overrides: Partial<ScoreListingInput> = {},
): ScoreListingInput {
  return {
    listingType: "RENTAL",
    contractType: "UNLIMITED",
    city: "Wien",
    district: 15,
    rooms: 2,
    hasSeparateBedroom: "YES",
    kitchen: "FITTED",
    washingMachine: "MACHINE_INCLUDED",
    parkingAvailability: "INCLUDED",
    availabilityDate: new Date("2026-09-20"),
    newerOrRenovatedSignal: "YES",
    airConditioning: "YES",
    balcony: "YES",
    elevator: "YES",
    storage: "YES",
    quietCourtyardSignal: "YES",
    ...overrides,
  };
}

function goodCost(baseRent = 700) {
  return computeCost({
    advertisedMonthlyTotal: unknownFact,
    baseRent: exactFact(baseRent),
    operatingCosts: exactFact(100),
    heatingCost: exactFact(30),
    hotWaterCost: exactFact(20),
    electricityEstimate: estimateFact(40),
    internetEstimate: estimateFact(30),
    parkingMonthlyCost: exactFact(0),
    deposit: exactFact(2 * baseRent),
    commission: exactFact(0),
    contractFee: exactFact(0),
    parkingAvailability: "INCLUDED",
    furnishedLevel: "FURNISHED",
    availabilityDate: new Date("2026-09-20"),
  });
}

const route = (durationMinutes: number, provider = "google"): CommuteInput => ({
  durationMinutes,
  rating: "EXCELLENT",
  provider,
});

describe("computeScore", () => {
  it("returns an explainable 0..100 score with completeness", () => {
    const result = computeScore(goodListing(), goodCost(), route(15), profile);
    expect(result.isZeroed).toBe(false);
    expect(result.totalScore).toBe(100);
    expect(result.dataCompleteness).toBe(100);
    expect(
      result.categories.every(
        (category) => category.reason && category.sourceConfidence,
      ),
    ).toBe(true);
  });

  it.each([
    [goodListing({ listingType: "SHARED_ROOM" }), "Shared"],
    [goodListing({ listingType: "SALE" }), "Purchase"],
    [goodListing({ city: "Graz" }), "Vienna"],
    [goodListing({ contractType: "TEMPORARY" }), "Temporary"],
    [goodListing({ hasSeparateBedroom: "NO" }), "bedroom"],
    [goodListing({ rooms: 1 }), "rooms"],
    [goodListing({ kitchen: "NONE" }), "kitchen"],
    [goodListing({ washingMachine: "CONNECTION_ONLY" }), "washing"],
  ])("zeroes a confirmed hard violation", (listing, reason) => {
    const result = computeScore(listing, goodCost(), route(15), profile);
    expect(result.isZeroed).toBe(true);
    expect(result.totalScore).toBe(0);
    expect(result.zeroReason?.toLowerCase()).toContain(reason.toLowerCase());
  });

  it("applies optional hard requirements only when enabled", () => {
    const listing = goodListing({
      parkingAvailability: "NONE",
      contractType: "TEMPORARY",
    });
    const relaxed = computeScore(listing, goodCost(), route(15), {
      ...profile,
      parkingRequired: false,
      longTermOnly: false,
    });
    expect(relaxed.isZeroed).toBe(false);
    const strictParking = computeScore(
      goodListing({ parkingAvailability: "NONE" }),
      goodCost(),
      route(15),
      { ...profile, parkingRequired: true },
    );
    expect(strictParking.isZeroed).toBe(true);
  });

  it("does not exclude UNKNOWN hard requirements, but gives them no points and lowers completeness", () => {
    const result = computeScore(
      goodListing({
        city: "UNKNOWN",
        rooms: null,
        hasSeparateBedroom: "UNKNOWN",
        kitchen: "UNKNOWN",
        washingMachine: "UNKNOWN",
        parkingAvailability: "UNKNOWN",
      }),
      goodCost(),
      null,
      { ...profile, parkingRequired: true },
    );
    expect(result.isZeroed).toBe(false);
    expect(result.dataCompleteness).toBeLessThan(70);
    expect(
      result.categories.find((category) => category.key === "layout")?.points,
    ).toBe(0);
    expect(
      result.categories.find((category) => category.key === "commute")?.points,
    ).toBe(0);
  });

  it("gives no budget points while any recurring all-in field is unknown", () => {
    const incomplete = computeCost({
      advertisedMonthlyTotal: unknownFact,
      baseRent: exactFact(700),
      operatingCosts: exactFact(100),
      heatingCost: unknownFact,
      hotWaterCost: unknownFact,
      electricityEstimate: unknownFact,
      internetEstimate: unknownFact,
      parkingMonthlyCost: unknownFact,
      deposit: unknownFact,
      commission: unknownFact,
      contractFee: unknownFact,
      parkingAvailability: "NONE",
      furnishedLevel: "UNKNOWN",
      availabilityDate: null,
    });
    const result = computeScore(goodListing(), incomplete, route(15), profile);
    expect(
      result.categories.find((category) => category.key === "budget")?.points,
    ).toBe(0);
    expect(result.dataCompleteness).toBeLessThan(100);
  });

  it("V17 scores profile estimates with half completeness credit", () => {
    const cost = computeCost(
      {
        advertisedMonthlyTotal: exactFact(800),
        baseRent: unknownFact,
        operatingCosts: unknownFact,
        heatingCost: unknownFact,
        hotWaterCost: unknownFact,
        electricityEstimate: unknownFact,
        internetEstimate: unknownFact,
        parkingMonthlyCost: unknownFact,
        deposit: unknownFact,
        commission: unknownFact,
        contractFee: unknownFact,
        parkingAvailability: "NONE",
        furnishedLevel: "UNKNOWN",
        availabilityDate: null,
      },
      1100,
      { energyMonthlyEstimate: 130, internetMonthlyEstimate: 30 },
    );
    const result = computeScore(goodListing(), cost, route(15), profile);
    const budget = result.categories.find(
      (category) => category.key === "budget",
    )!;

    expect(budget.points).toBeGreaterThan(0);
    expect(budget.sourceConfidence).toBe("ESTIMATE");
    expect(budget.completeness).toBe(67);
  });

  it("scales commute against the profile threshold and caps mock results at half weight", () => {
    const sixtyMinuteProfile = { ...profile, maxCommuteMinutes: 60 };
    const verified = computeScore(
      goodListing(),
      goodCost(),
      route(40),
      sixtyMinuteProfile,
    );
    const mock = computeScore(
      goodListing(),
      goodCost(),
      route(40, "mock"),
      sixtyMinuteProfile,
    );
    expect(
      verified.categories.find((category) => category.key === "commute")
        ?.points,
    ).toBe(profile.weights.commute);
    expect(
      mock.categories.find((category) => category.key === "commute")?.points,
    ).toBe(profile.weights.commute / 2);
  });

  it("rejects invalid commute results instead of classifying them as excellent", () => {
    const result = computeScore(goodListing(), goodCost(), route(0), profile);
    const commute = result.categories.find(
      (category) => category.key === "commute",
    )!;
    expect(commute.points).toBe(0);
    expect(commute.notCalculated).toBe(true);
  });

  it("makes the no-commission preference affect scoring", () => {
    const withCommission = computeCost({
      ...{
        advertisedMonthlyTotal: unknownFact,
        baseRent: exactFact(700),
        operatingCosts: exactFact(100),
        heatingCost: exactFact(30),
        hotWaterCost: exactFact(20),
        electricityEstimate: estimateFact(40),
        internetEstimate: estimateFact(30),
        parkingMonthlyCost: exactFact(0),
        deposit: exactFact(1400),
        contractFee: exactFact(0),
        parkingAvailability: "INCLUDED" as const,
        furnishedLevel: "FURNISHED" as const,
        availabilityDate: new Date("2026-09-20"),
      },
      commission: exactFact(500),
    });
    const strict = computeScore(
      goodListing(),
      withCommission,
      route(15),
      profile,
    );
    const relaxed = computeScore(goodListing(), withCommission, route(15), {
      ...profile,
      preferNoCommission: false,
    });
    expect(relaxed.totalScore).toBeGreaterThan(strict.totalScore);
  });

  it("always clamps the result to 0..100", () => {
    for (const rent of [0, 700, 1100, 10_000]) {
      const result = computeScore(
        goodListing(),
        goodCost(rent),
        route(15),
        profile,
      );
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    }
  });
});

describe("Vienna boundary", () => {
  it("accepts Vienna aliases but rejects Wiener Neustadt", () => {
    expect(isViennaLocation("Wien")).toBe(true);
    expect(isViennaLocation("Vienna, Austria")).toBe(true);
    expect(isViennaLocation("Wiener Neustadt")).toBe(false);
  });
});
