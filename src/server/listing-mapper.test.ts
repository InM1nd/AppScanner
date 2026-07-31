import { describe, expect, it } from "vitest";
import { factsToSparseColumns, type MoneyField } from "./listing-mapper";
import type { FinancialFact } from "@/types/listing";

describe("factsToSparseColumns", () => {
  it("keeps confirmed facts and omits unknown facts during refresh", () => {
    const unknown: FinancialFact = {
      amount: null,
      confidence: "UNKNOWN",
      sourceText: null,
    };
    const facts = Object.fromEntries(
      [
        "advertisedMonthlyTotal",
        "baseRent",
        "operatingCosts",
        "heatingCost",
        "hotWaterCost",
        "electricityEstimate",
        "internetEstimate",
        "parkingMonthlyCost",
        "deposit",
        "commission",
        "contractFee",
      ].map((field) => [field, unknown]),
    ) as Record<MoneyField, FinancialFact>;
    facts.baseRent = {
      amount: 900,
      confidence: "EXACT",
      sourceText: "provider",
    };

    expect(factsToSparseColumns(facts)).toEqual({
      baseRentAmount: 900,
      baseRentConfidence: "EXACT",
      baseRentSourceText: "provider",
    });
  });
});
