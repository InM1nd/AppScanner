import type { SearchProfile as PrismaSearchProfile } from "@prisma/client";
import {
  scoringWeights,
  defaultScoringWeights,
  searchProfile,
  type SearchProfile,
} from "@/types/search-profile";
import type { ScoreProfileInput } from "@/lib/score";
import { toNum } from "./decimal";

function parseWeights(json: unknown) {
  const parsed = scoringWeights.safeParse(json);
  return parsed.success ? parsed.data : defaultScoringWeights;
}

export function toScoreProfileInput(
  profile: PrismaSearchProfile,
): ScoreProfileInput {
  return {
    preferredDistricts: profile.preferredDistricts,
    secondaryDistricts: profile.secondaryDistricts,
    maxCommuteMinutes: profile.maxCommuteMinutes,
    requireSeparateBedroom: profile.requireSeparateBedroom,
    minRooms: profile.minRooms,
    targetMonthlyMax: toNum(profile.targetMonthlyMax) ?? 1000,
    absoluteMonthlyMax: toNum(profile.absoluteMonthlyMax) ?? 1100,
    moveInEarliest: profile.moveInEarliest,
    moveInLatest: profile.moveInLatest,
    needsFittedKitchen: profile.needsFittedKitchen,
    needsWashingMachine: profile.needsWashingMachine,
    parkingRequired: profile.parkingRequired,
    preferNoCommission: profile.preferNoCommission,
    longTermOnly: profile.longTermOnly,
    weights: parseWeights(profile.scoringWeights),
  };
}

export function toDomainSearchProfile(
  profile: PrismaSearchProfile,
): SearchProfile {
  return searchProfile.parse({
    city: profile.city,
    preferredDistricts: profile.preferredDistricts,
    secondaryDistricts: profile.secondaryDistricts,
    workDestinationLat: profile.workDestinationLat,
    workDestinationLng: profile.workDestinationLng,
    workDestinationLabel: profile.workDestinationLabel,
    maxCommuteMinutes: profile.maxCommuteMinutes,
    requireSeparateBedroom: profile.requireSeparateBedroom,
    minRooms: profile.minRooms,
    targetMonthlyMin: toNum(profile.targetMonthlyMin) ?? 900,
    targetMonthlyMax: toNum(profile.targetMonthlyMax) ?? 1000,
    absoluteMonthlyMax: toNum(profile.absoluteMonthlyMax) ?? 1100,
    moveInEarliest: profile.moveInEarliest,
    moveInLatest: profile.moveInLatest,
    needsFittedKitchen: profile.needsFittedKitchen,
    needsWashingMachine: profile.needsWashingMachine,
    parkingRequired: profile.parkingRequired,
    petsAllowed: profile.petsAllowed,
    preferNoCommission: profile.preferNoCommission,
    longTermOnly: profile.longTermOnly,
    scoringWeights: parseWeights(profile.scoringWeights),
  });
}
