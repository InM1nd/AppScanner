// Pure, provider-agnostic cost calculation. Unknown facts never become zero:
// totals are explicitly partial and the missing fields travel with them.

import type { FinancialConfidence } from "@/types/enums";
import type { FinancialFact, NormalizedListing } from "@/types/listing";

const HOUSING_RECURRING_FIELDS = [
  "advertisedMonthlyTotal",
  "baseRent",
  "operatingCosts",
  "heatingCost",
  "hotWaterCost",
  "parkingMonthlyCost",
] as const;
const UTILITY_RECURRING_FIELDS = [
  "electricityEstimate",
  "internetEstimate",
] as const;
const UPFRONT_FIELDS = ["deposit", "commission", "contractFee"] as const;

export type HousingRecurringField = (typeof HOUSING_RECURRING_FIELDS)[number];
export type RecurringField =
  HousingRecurringField | (typeof UTILITY_RECURRING_FIELDS)[number];
export type UpfrontField =
  (typeof UPFRONT_FIELDS)[number] | "firstMonth" | "furnitureSetupEstimate";

export type CostRedFlag =
  | "OVER_ABSOLUTE_MAX"
  | "HEATING_UNCLEAR"
  | "ELECTRICITY_UNCLEAR"
  | "PARKING_SEPARATE_COST"
  | "COMMISSION_OR_CONTRACT_FEE"
  | "HIGH_DEPOSIT"
  | "NO_AVAILABILITY_DATE";

export interface CostBreakdown {
  /** Housing-only subtotal from all available exact and estimated facts. */
  housingSubtotal: number;
  /** Exact recurring all-in cost (housing + electricity + internet). */
  monthlyKnownCost: number;
  /** Available exact/estimated recurring all-in cost; partial when fields are unknown. */
  monthlyLikelyTotal: number;
  recurringFieldCount: number;
  unknownRecurringFields: RecurringField[];
  hasUnknownRecurringCost: boolean;
  /** Backwards-compatible aliases used by persistence while it is migrated. */
  unknownMandatoryFields: RecurringField[];
  hasUnknownMandatoryCost: boolean;
  electricityEstimate: FinancialFact;
  internetEstimate: FinancialFact;
  upfrontKnownTotal: number;
  unknownUpfrontFields: UpfrontField[];
  hasUnknownUpfrontCost: boolean;
  upfrontCost: {
    deposit: number | null;
    depositConfidence: FinancialConfidence;
    commission: number | null;
    commissionConfidence: FinancialConfidence;
    contractFee: number | null;
    contractFeeConfidence: FinancialConfidence;
    firstMonth: number;
    furnitureSetupEstimate: number;
    /** Available exact/estimated total. This is a lower bound when unknownUpfrontFields is non-empty. */
    total: number;
  };
  redFlags: CostRedFlag[];
}

// ponytail: flat heuristic, no field for actual furniture cost exists yet.
// Upgrade to a per-room or per-sqm estimate if this proves too rough in practice.
const FURNITURE_SETUP_ESTIMATE_EUR = 1500;

function isKnown(
  fact: FinancialFact,
): fact is FinancialFact & { amount: number } {
  return fact.amount !== null && fact.confidence !== "UNKNOWN";
}

function isExact(
  fact: FinancialFact,
): fact is FinancialFact & { amount: number } {
  return fact.amount !== null && fact.confidence === "EXACT";
}

export function computeCost(
  listing: Pick<
    NormalizedListing,
    | "advertisedMonthlyTotal"
    | "baseRent"
    | "operatingCosts"
    | "heatingCost"
    | "hotWaterCost"
    | "electricityEstimate"
    | "internetEstimate"
    | "parkingMonthlyCost"
    | "deposit"
    | "commission"
    | "contractFee"
    | "parkingAvailability"
    | "furnishedLevel"
    | "availabilityDate"
  >,
  absoluteMonthlyMax = 1100,
): CostBreakdown {
  const recurringFacts: Record<RecurringField, FinancialFact> = {
    advertisedMonthlyTotal: listing.advertisedMonthlyTotal,
    baseRent: listing.baseRent,
    operatingCosts: listing.operatingCosts,
    heatingCost: listing.heatingCost,
    hotWaterCost: listing.hotWaterCost,
    parkingMonthlyCost: listing.parkingMonthlyCost,
    electricityEstimate: listing.electricityEstimate,
    internetEstimate: listing.internetEstimate,
  };
  const housingFields: HousingRecurringField[] = isKnown(
    listing.advertisedMonthlyTotal,
  )
    ? [
        "advertisedMonthlyTotal",
        "heatingCost",
        "hotWaterCost",
        "parkingMonthlyCost",
      ]
    : [
        "baseRent",
        "operatingCosts",
        "heatingCost",
        "hotWaterCost",
        "parkingMonthlyCost",
      ];
  const activeRecurringFields = [
    ...housingFields,
    ...UTILITY_RECURRING_FIELDS,
  ].filter(
    (field) =>
      field !== "parkingMonthlyCost" ||
      listing.parkingAvailability === "AVAILABLE_EXTRA_COST",
  );

  let housingSubtotal = 0;
  let monthlyKnownCost = 0;
  let monthlyLikelyTotal = 0;
  const unknownRecurringFields: RecurringField[] = [];

  for (const field of activeRecurringFields) {
    const fact = recurringFacts[field];
    if (!isKnown(fact)) {
      unknownRecurringFields.push(field);
      continue;
    }
    monthlyLikelyTotal += fact.amount;
    if ((HOUSING_RECURRING_FIELDS as readonly string[]).includes(field))
      housingSubtotal += fact.amount;
    if (isExact(fact)) monthlyKnownCost += fact.amount;
  }

  const upfrontFacts = {
    deposit: listing.deposit,
    commission: listing.commission,
    contractFee: listing.contractFee,
  };
  let upfrontKnownTotal = monthlyKnownCost;
  let upfrontLikelyTotal = monthlyLikelyTotal;
  const unknownUpfrontFields: UpfrontField[] = [];

  for (const field of UPFRONT_FIELDS) {
    const fact = upfrontFacts[field];
    if (!isKnown(fact)) {
      unknownUpfrontFields.push(field);
      continue;
    }
    upfrontLikelyTotal += fact.amount;
    if (isExact(fact)) upfrontKnownTotal += fact.amount;
  }
  if (unknownRecurringFields.length > 0)
    unknownUpfrontFields.push("firstMonth");

  let furnitureSetupEstimate = 0;
  if (listing.furnishedLevel === "UNFURNISHED") {
    furnitureSetupEstimate = FURNITURE_SETUP_ESTIMATE_EUR;
    upfrontLikelyTotal += furnitureSetupEstimate;
  } else if (listing.furnishedLevel === "UNKNOWN") {
    unknownUpfrontFields.push("furnitureSetupEstimate");
  }

  const deposit = isKnown(listing.deposit) ? listing.deposit.amount : null;
  const commission = isKnown(listing.commission)
    ? listing.commission.amount
    : null;
  const contractFee = isKnown(listing.contractFee)
    ? listing.contractFee.amount
    : null;
  const grossMonthlyRentForDepositCheck =
    housingSubtotal ||
    (isKnown(listing.baseRent) ? listing.baseRent.amount : 0);

  const redFlags: CostRedFlag[] = [];
  if (monthlyLikelyTotal > absoluteMonthlyMax)
    redFlags.push("OVER_ABSOLUTE_MAX");
  if (!isKnown(listing.heatingCost)) redFlags.push("HEATING_UNCLEAR");
  if (!isKnown(listing.electricityEstimate))
    redFlags.push("ELECTRICITY_UNCLEAR");
  if (listing.parkingAvailability === "AVAILABLE_EXTRA_COST")
    redFlags.push("PARKING_SEPARATE_COST");
  if ((commission ?? 0) > 0 || (contractFee ?? 0) > 0)
    redFlags.push("COMMISSION_OR_CONTRACT_FEE");
  if (
    grossMonthlyRentForDepositCheck > 0 &&
    deposit !== null &&
    deposit > 3 * grossMonthlyRentForDepositCheck
  ) {
    redFlags.push("HIGH_DEPOSIT");
  }
  if (!listing.availabilityDate) redFlags.push("NO_AVAILABILITY_DATE");

  return {
    housingSubtotal,
    monthlyKnownCost,
    monthlyLikelyTotal,
    recurringFieldCount: activeRecurringFields.length,
    unknownRecurringFields,
    hasUnknownRecurringCost: unknownRecurringFields.length > 0,
    unknownMandatoryFields: unknownRecurringFields,
    hasUnknownMandatoryCost: unknownRecurringFields.length > 0,
    electricityEstimate: listing.electricityEstimate,
    internetEstimate: listing.internetEstimate,
    upfrontKnownTotal,
    unknownUpfrontFields,
    hasUnknownUpfrontCost: unknownUpfrontFields.length > 0,
    upfrontCost: {
      deposit,
      depositConfidence: listing.deposit.confidence,
      commission,
      commissionConfidence: listing.commission.confidence,
      contractFee,
      contractFeeConfidence: listing.contractFee.confidence,
      firstMonth: monthlyLikelyTotal,
      furnitureSetupEstimate,
      total: upfrontLikelyTotal,
    },
    redFlags,
  };
}
