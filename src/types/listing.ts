import { z } from "zod";
import {
  ContractType,
  FinancialConfidence,
  FurnishedLevel,
  HeatingType,
  ImportMethod,
  KitchenType,
  ListingType,
  ParkingAvailability,
  TriState,
  WashingMachineOption,
} from "./enums";

// A single financial fact: an amount that may be exact, estimated, or
// entirely unknown, plus a human-readable explanation of where it came from.
// Every money field on a listing uses this shape (see AGENTS.md).
export const financialFact = z.object({
  amount: z.number().nonnegative().nullable(),
  confidence: FinancialConfidence,
  sourceText: z.string().nullable(),
});
export type FinancialFact = z.infer<typeof financialFact>;

export const unknownFact: FinancialFact = {
  amount: null,
  confidence: "UNKNOWN",
  sourceText: null,
};

export function exactFact(amount: number, sourceText?: string): FinancialFact {
  return { amount, confidence: "EXACT", sourceText: sourceText ?? null };
}

export function estimateFact(
  amount: number,
  sourceText?: string,
): FinancialFact {
  return { amount, confidence: "ESTIMATE", sourceText: sourceText ?? null };
}

// The provider-agnostic listing shape returned by ListingProvider.importFromUrl
// / parseEmailAlert, before it is persisted. Mirrors the Prisma Listing model
// but keeps money fields grouped as FinancialFact and has no DB-only fields
// (id, timestamps, relations, computed totals).
export const normalizedListing = z.object({
  title: z.string().min(1),
  sourceListingId: z.string().nullable(),
  canonicalUrl: z.string().url(),
  importMethod: ImportMethod,
  createdAtSource: z.coerce.date().nullable(),

  listingType: ListingType,

  city: z.string().default("Wien"),
  address: z.string().nullable(),
  postalCode: z.string().nullable(),
  district: z.number().int().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),

  rooms: z.number().positive().nullable(),
  squareMeters: z.number().positive().nullable(),
  hasSeparateBedroom: TriState,
  furnishedLevel: FurnishedLevel,

  baseRent: financialFact,
  operatingCosts: financialFact,
  heatingCost: financialFact,
  hotWaterCost: financialFact,
  electricityEstimate: financialFact,
  internetEstimate: financialFact,
  parkingMonthlyCost: financialFact,
  deposit: financialFact,
  commission: financialFact,
  contractFee: financialFact,

  availabilityDate: z.coerce.date().nullable(),
  contractType: ContractType,

  kitchen: KitchenType,
  washingMachine: WashingMachineOption,
  parkingAvailability: ParkingAvailability,
  elevator: TriState,
  balcony: TriState,
  airConditioning: TriState,
  storage: TriState,
  quietCourtyardSignal: TriState,
  newerOrRenovatedSignal: TriState,
  heatingType: HeatingType,
  energyRating: z.string().nullable(),

  description: z.string().nullable(),
  photos: z.array(z.string().url()).default([]),
  contactMethod: z.string().nullable(),
});
export type NormalizedListing = z.infer<typeof normalizedListing>;

// A fully-blank listing draft, used as the base for manual entry / partial
// parses. Callers spread overrides on top of this.
export const blankNormalizedListing: NormalizedListing = {
  title: "",
  sourceListingId: null,
  canonicalUrl: "",
  importMethod: "MANUAL",
  createdAtSource: null,
  listingType: "UNKNOWN",
  city: "Wien",
  address: null,
  postalCode: null,
  district: null,
  latitude: null,
  longitude: null,
  rooms: null,
  squareMeters: null,
  hasSeparateBedroom: "UNKNOWN",
  furnishedLevel: "UNKNOWN",
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
  availabilityDate: null,
  contractType: "UNKNOWN",
  kitchen: "UNKNOWN",
  washingMachine: "UNKNOWN",
  parkingAvailability: "UNKNOWN",
  elevator: "UNKNOWN",
  balcony: "UNKNOWN",
  airConditioning: "UNKNOWN",
  storage: "UNKNOWN",
  quietCourtyardSignal: "UNKNOWN",
  newerOrRenovatedSignal: "UNKNOWN",
  heatingType: "UNKNOWN",
  energyRating: null,
  description: null,
  photos: [],
  contactMethod: null,
};
