import { describe, expect, it } from "vitest";
import { computeCost } from "@/lib/cost";
import {
  blankNormalizedListing,
  estimateFact,
  exactFact,
  unknownFact,
} from "@/types/listing";

function baseListing() {
  return {
    ...blankNormalizedListing,
    advertisedMonthlyTotal: unknownFact,
    baseRent: exactFact(800),
    operatingCosts: exactFact(150),
    heatingCost: exactFact(50),
    hotWaterCost: exactFact(20),
    parkingMonthlyCost: unknownFact,
    electricityEstimate: estimateFact(80),
    internetEstimate: estimateFact(30),
    deposit: exactFact(1600),
    commission: unknownFact,
    contractFee: unknownFact,
    parkingAvailability: "NONE" as const,
    furnishedLevel: "UNFURNISHED" as const,
    availabilityDate: new Date("2026-09-20"),
  };
}

describe("computeCost", () => {
  it("sums only EXACT fields into monthlyKnownCost", () => {
    const result = computeCost(baseListing());
    expect(result.monthlyKnownCost).toBe(800 + 150 + 50 + 20);
    expect(result.housingSubtotal).toBe(800 + 150 + 50 + 20);
  });

  it("flags unknown mandatory fields and excludes them from known/likely totals", () => {
    const listing = { ...baseListing(), heatingCost: unknownFact };
    const result = computeCost(listing);
    expect(result.unknownMandatoryFields).toContain("heatingCost");
    expect(result.hasUnknownMandatoryCost).toBe(true);
    expect(result.monthlyLikelyTotal).toBe(800 + 150 + 20 + 80 + 30);
  });

  it("uses available electricity/internet estimates in the all-in likely total", () => {
    const result = computeCost(baseListing());
    expect(result.monthlyLikelyTotal).toBe(800 + 150 + 50 + 20 + 80 + 30);
    expect(result.electricityEstimate.amount).toBe(80);
    expect(result.internetEstimate.amount).toBe(30);
  });

  it("uses an advertised monthly total instead of double-counting rent components", () => {
    const result = computeCost({
      ...baseListing(),
      advertisedMonthlyTotal: exactFact(950),
      baseRent: exactFact(863),
      operatingCosts: exactFact(87),
    });
    expect(result.housingSubtotal).toBe(950 + 50 + 20);
    expect(result.monthlyLikelyTotal).toBe(950 + 50 + 20 + 80 + 30);
    expect(result.unknownRecurringFields).not.toContain("baseRent");
    expect(result.unknownRecurringFields).not.toContain("operatingCosts");
  });

  it("flags cost over the absolute monthly max", () => {
    const listing = { ...baseListing(), baseRent: exactFact(1200) };
    const result = computeCost(listing, 1100);
    expect(result.redFlags).toContain("OVER_ABSOLUTE_MAX");
  });

  it("flags deposit exceeding 3 gross monthly rents", () => {
    const listing = { ...baseListing(), deposit: exactFact(5000) };
    const result = computeCost(listing);
    expect(result.redFlags).toContain("HIGH_DEPOSIT");
  });

  it("flags missing availability date", () => {
    const listing = { ...baseListing(), availabilityDate: null };
    const result = computeCost(listing);
    expect(result.redFlags).toContain("NO_AVAILABILITY_DATE");
  });

  it("flags separate parking cost and commission/contract fees", () => {
    const listing = {
      ...baseListing(),
      parkingAvailability: "AVAILABLE_EXTRA_COST" as const,
      commission: exactFact(500),
    };
    const result = computeCost(listing);
    expect(result.redFlags).toContain("PARKING_SEPARATE_COST");
    expect(result.redFlags).toContain("COMMISSION_OR_CONTRACT_FEE");
  });

  it("keeps unknown hot water visible in the recurring completeness", () => {
    const listing = { ...baseListing(), hotWaterCost: unknownFact };
    const result = computeCost(listing);
    expect(result.unknownRecurringFields).toContain("hotWaterCost");
    expect(result.hasUnknownRecurringCost).toBe(true);
  });

  it("does not gate budget transparency on parking cost when there's no parking", () => {
    const result = computeCost(baseListing()); // parkingMonthlyCost unknown, parkingAvailability NONE
    expect(result.unknownMandatoryFields).not.toContain("parkingMonthlyCost");
    expect(result.hasUnknownMandatoryCost).toBe(false);
  });

  it("gates budget transparency on parking cost when parking exists at extra cost", () => {
    const listing = {
      ...baseListing(),
      parkingAvailability: "AVAILABLE_EXTRA_COST" as const,
    };
    const result = computeCost(listing);
    expect(result.unknownMandatoryFields).toContain("parkingMonthlyCost");
    expect(result.hasUnknownMandatoryCost).toBe(true);
  });

  it("computes upfront cost including furniture estimate only when unfurnished", () => {
    const unfurnished = computeCost(baseListing());
    const furnished = computeCost({
      ...baseListing(),
      furnishedLevel: "FURNISHED" as const,
    });
    expect(unfurnished.upfrontCost.furnitureSetupEstimate).toBe(1500);
    expect(furnished.upfrontCost.furnitureSetupEstimate).toBe(0);
    expect(unfurnished.upfrontCost.total).toBe(
      (unfurnished.upfrontCost.deposit ?? 0) +
        (unfurnished.upfrontCost.commission ?? 0) +
        (unfurnished.upfrontCost.contractFee ?? 0) +
        unfurnished.upfrontCost.firstMonth +
        unfurnished.upfrontCost.furnitureSetupEstimate,
    );
  });

  it("represents an unknown deposit as unknown and exposes a known lower bound", () => {
    const result = computeCost({
      ...baseListing(),
      deposit: unknownFact,
      furnishedLevel: "FURNISHED" as const,
    });
    expect(result.upfrontCost.deposit).toBeNull();
    expect(result.unknownUpfrontFields).toContain("deposit");
    expect(result.hasUnknownUpfrontCost).toBe(true);
    expect(result.upfrontKnownTotal).toBe(result.monthlyKnownCost);
  });
});
