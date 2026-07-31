// Maps between the flat Prisma Listing row (money fields as
// amount/confidence/sourceText triples, per AGENTS.md) and the grouped
// FinancialFact shape used by the pure domain logic in src/lib.

import type { FinancialFact } from "@/types/listing";
import { toNum } from "./decimal";

export const MONEY_FIELDS = [
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
] as const;

export type MoneyField = (typeof MONEY_FIELDS)[number];

export function factsFromRow(
  row: Record<string, unknown>,
): Record<MoneyField, FinancialFact> {
  const result = {} as Record<MoneyField, FinancialFact>;
  for (const field of MONEY_FIELDS) {
    result[field] = {
      amount: toNum(row[`${field}Amount`] as Parameters<typeof toNum>[0]),
      confidence: row[`${field}Confidence`] as FinancialFact["confidence"],
      sourceText: row[`${field}SourceText`] as string | null,
    };
  }
  return result;
}

export function factsToColumns(
  facts: Record<MoneyField, FinancialFact>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const field of MONEY_FIELDS) {
    const fact = facts[field];
    columns[`${field}Amount`] = fact.amount;
    columns[`${field}Confidence`] = fact.confidence;
    columns[`${field}SourceText`] = fact.sourceText;
  }
  return columns;
}

export function factsToSparseColumns(
  facts: Record<MoneyField, FinancialFact>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const field of MONEY_FIELDS) {
    const fact = facts[field];
    if (fact.confidence === "UNKNOWN" || fact.amount === null) continue;
    columns[`${field}Amount`] = fact.amount;
    columns[`${field}Confidence`] = fact.confidence;
    columns[`${field}SourceText`] = fact.sourceText;
  }
  return columns;
}
