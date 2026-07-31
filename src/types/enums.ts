// Mirrors prisma/schema.prisma enums. Kept as plain string-union Zod enums so
// pure domain logic (src/lib) has zero Prisma dependency and can be unit
// tested without a database.

import { z } from "zod";

export const FinancialConfidence = z.enum(["EXACT", "ESTIMATE", "UNKNOWN"]);
export type FinancialConfidence = z.infer<typeof FinancialConfidence>;

export const ImportMethod = z.enum(["MANUAL", "URL_METADATA", "EMAIL_ALERT"]);
export type ImportMethod = z.infer<typeof ImportMethod>;

export const ListingStatus = z.enum([
  "NEW",
  "REVIEWING",
  "CONTACTED",
  "VIEWING",
  "SHORTLISTED",
  "REJECTED",
  "ARCHIVED",
]);
export type ListingStatus = z.infer<typeof ListingStatus>;

export const ContractType = z.enum([
  "UNLIMITED",
  "FIXED_TERM",
  "TEMPORARY",
  "UNKNOWN",
]);
export type ContractType = z.infer<typeof ContractType>;

export const ListingType = z.enum(["RENTAL", "SALE", "SHARED_ROOM", "UNKNOWN"]);
export type ListingType = z.infer<typeof ListingType>;

export const FurnishedLevel = z.enum([
  "UNFURNISHED",
  "PARTLY_FURNISHED",
  "FURNISHED",
  "UNKNOWN",
]);
export type FurnishedLevel = z.infer<typeof FurnishedLevel>;

export const KitchenType = z.enum(["FITTED", "BASIC", "NONE", "UNKNOWN"]);
export type KitchenType = z.infer<typeof KitchenType>;

export const WashingMachineOption = z.enum([
  "MACHINE_INCLUDED",
  "CONNECTION_ONLY",
  "NONE",
  "UNKNOWN",
]);
export type WashingMachineOption = z.infer<typeof WashingMachineOption>;

export const ParkingAvailability = z.enum([
  "INCLUDED",
  "AVAILABLE_EXTRA_COST",
  "NONE",
  "UNKNOWN",
]);
export type ParkingAvailability = z.infer<typeof ParkingAvailability>;

export const TriState = z.enum(["YES", "NO", "UNKNOWN"]);
export type TriState = z.infer<typeof TriState>;

export const HeatingType = z.enum([
  "DISTRICT",
  "GAS",
  "ELECTRIC",
  "FLOOR",
  "OTHER",
  "UNKNOWN",
]);
export type HeatingType = z.infer<typeof HeatingType>;

export const CommuteRating = z.enum([
  "EXCELLENT",
  "ACCEPTABLE",
  "WARNING",
  "POOR",
  "NOT_CALCULATED",
]);
export type CommuteRating = z.infer<typeof CommuteRating>;

export const ProviderName = z.enum([
  "WILLHABEN",
  "IMMOSCOUT24_AT",
  "IMMOWELT_AT",
  "DER_STANDARD",
  "FINDMYHOME",
  "LYSTIO",
  "GENERIC_URL",
  "MANUAL",
]);
export type ProviderName = z.infer<typeof ProviderName>;
