// Server → Client component boundary: Prisma's Decimal fields cannot cross
// that boundary (React Flight serialization doesn't support them), so every
// Listing money field is converted to a plain number here. Dates and nested
// relations pass through unchanged (both are Flight-serializable).

import type { ListingCard, ListingDetail } from "./queries";
import { toNum } from "./decimal";
import { MONEY_FIELDS } from "./listing-mapper";

function serializeMoneyFields<T extends Record<string, unknown>>(listing: T) {
  const result: Record<string, unknown> = { ...listing };
  for (const field of MONEY_FIELDS) {
    result[`${field}Amount`] = toNum(listing[`${field}Amount`] as never);
  }
  result.monthlyKnownCost = toNum(listing.monthlyKnownCost as never);
  result.monthlyHousingSubtotal = toNum(
    listing.monthlyHousingSubtotal as never,
  );
  result.monthlyLikelyTotal = toNum(listing.monthlyLikelyTotal as never);
  result.upfrontCostEstimate = toNum(listing.upfrontCostEstimate as never);
  result.upfrontKnownTotal = toNum(listing.upfrontKnownTotal as never);
  return result;
}

export type ListingCardVM = Omit<
  ListingCard,
  | "advertisedMonthlyTotalAmount"
  | "baseRentAmount"
  | "operatingCostsAmount"
  | "heatingCostAmount"
  | "hotWaterCostAmount"
  | "electricityEstimateAmount"
  | "internetEstimateAmount"
  | "parkingMonthlyCostAmount"
  | "depositAmount"
  | "commissionAmount"
  | "contractFeeAmount"
  | "monthlyKnownCost"
  | "monthlyHousingSubtotal"
  | "monthlyLikelyTotal"
  | "upfrontCostEstimate"
  | "upfrontKnownTotal"
> & {
  advertisedMonthlyTotalAmount: number | null;
  baseRentAmount: number | null;
  operatingCostsAmount: number | null;
  heatingCostAmount: number | null;
  hotWaterCostAmount: number | null;
  electricityEstimateAmount: number | null;
  internetEstimateAmount: number | null;
  parkingMonthlyCostAmount: number | null;
  depositAmount: number | null;
  commissionAmount: number | null;
  contractFeeAmount: number | null;
  monthlyKnownCost: number | null;
  monthlyHousingSubtotal: number | null;
  monthlyLikelyTotal: number | null;
  upfrontCostEstimate: number | null;
  upfrontKnownTotal: number | null;
};

export type ListingDetailVM = ListingCardVM &
  Pick<ListingDetail, "notes" | "snapshots">;

export function toListingCardVM(listing: ListingCard): ListingCardVM {
  return serializeMoneyFields(listing) as ListingCardVM;
}

export function toListingDetailVM(listing: ListingDetail): ListingDetailVM {
  return serializeMoneyFields(listing) as ListingDetailVM;
}
