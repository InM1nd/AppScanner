// Transparent 100-point scoring. Unknown data never earns points; category
// completeness explains how much trustworthy input the result is based on.

import { isValidCommuteDuration } from "@/lib/commute/rating";
import type { CommuteRating, FinancialConfidence } from "@/types/enums";
import type { NormalizedListing } from "@/types/listing";
import { scoringWeights, type ScoringWeights } from "@/types/search-profile";
import type { CostBreakdown } from "./cost";

export type ScoreCategoryKey =
  | "budget"
  | "commute"
  | "layout"
  | "condition"
  | "parking"
  | "moveIn"
  | "contract"
  | "infrastructure";

export interface ScoreCategory {
  key: ScoreCategoryKey;
  label: string;
  points: number;
  max: number;
  reason: string;
  sourceConfidence: FinancialConfidence;
  completeness: number;
  notCalculated?: boolean;
}

export interface ScoreResult {
  totalScore: number;
  dataCompleteness: number;
  isZeroed: boolean;
  zeroReason: string | null;
  categories: ScoreCategory[];
}

export interface CommuteInput {
  durationMinutes: number | null;
  rating: CommuteRating;
  provider: string;
}

export interface ScoreListingInput {
  listingType: NormalizedListing["listingType"];
  contractType: NormalizedListing["contractType"];
  city: string;
  district: number | null;
  rooms: number | null;
  hasSeparateBedroom: NormalizedListing["hasSeparateBedroom"];
  kitchen: NormalizedListing["kitchen"];
  washingMachine: NormalizedListing["washingMachine"];
  parkingAvailability: NormalizedListing["parkingAvailability"];
  availabilityDate: Date | null;
  newerOrRenovatedSignal: NormalizedListing["newerOrRenovatedSignal"];
  airConditioning: NormalizedListing["airConditioning"];
  balcony: NormalizedListing["balcony"];
  elevator: NormalizedListing["elevator"];
  storage: NormalizedListing["storage"];
  quietCourtyardSignal: NormalizedListing["quietCourtyardSignal"];
}

export interface ScoreProfileInput {
  preferredDistricts: number[];
  secondaryDistricts: number[];
  maxCommuteMinutes: number;
  requireSeparateBedroom: boolean;
  minRooms: number;
  targetMonthlyMax: number;
  absoluteMonthlyMax: number;
  moveInEarliest: Date;
  moveInLatest: Date;
  needsFittedKitchen: boolean;
  needsWashingMachine: boolean;
  parkingRequired: boolean;
  preferNoCommission: boolean;
  longTermOnly: boolean;
  weights: ScoringWeights;
}

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
const percent = (known: number, total: number) =>
  total === 0 ? 100 : Math.round((known / total) * 100);

export function isViennaLocation(city: string): boolean {
  const normalized = city.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, " ");
  if (/\bwien(?:er neustadt| umgebung)\b/.test(normalized)) return false;
  return /(?:^|[^a-z])(?:wien|vienna)(?:$|[^a-z])/.test(normalized);
}

function hasKnownCity(city: string): boolean {
  return city.trim() !== "" && !/^(?:unknown|unbekannt)$/i.test(city.trim());
}

function scoreBudget(
  cost: CostBreakdown,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  const profileEstimateCount = Object.keys(
    cost.profileEstimateAssumptions,
  ).length;
  const completeness = percent(
    cost.recurringFieldCount -
      cost.unknownRecurringFields.length -
      profileEstimateCount * 0.5,
    cost.recurringFieldCount,
  );
  if (cost.hasUnknownRecurringCost) {
    return {
      key: "budget",
      label: "Budget & cost transparency",
      points: 0,
      max,
      reason: `Recurring all-in cost is incomplete (missing: ${cost.unknownRecurringFields.join(", ")}).`,
      sourceConfidence: "UNKNOWN",
      completeness,
    };
  }

  const total = cost.monthlyLikelyTotal;
  const range = profile.absoluteMonthlyMax - profile.targetMonthlyMax;
  const points =
    total <= profile.targetMonthlyMax
      ? max
      : total <= profile.absoluteMonthlyMax && range > 0
        ? max * ((profile.absoluteMonthlyMax - total) / range)
        : 0;
  return {
    key: "budget",
    label: "Budget & cost transparency",
    points: round(clamp(points, 0, max)),
    max,
    reason:
      total <= profile.targetMonthlyMax
        ? `€${total}/mo all-in is within the €${profile.targetMonthlyMax} target.`
        : total <= profile.absoluteMonthlyMax
          ? `€${total}/mo all-in is above target but under the €${profile.absoluteMonthlyMax} maximum.`
          : `€${total}/mo all-in exceeds the €${profile.absoluteMonthlyMax} absolute maximum.`,
    sourceConfidence:
      cost.monthlyKnownCost === cost.monthlyLikelyTotal ? "EXACT" : "ESTIMATE",
    completeness,
  };
}

function scoreCommute(
  commute: CommuteInput | null,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  if (
    !commute ||
    commute.rating === "NOT_CALCULATED" ||
    commute.durationMinutes === null ||
    !isValidCommuteDuration(commute.durationMinutes)
  ) {
    return {
      key: "commute",
      label: "Commute",
      points: 0,
      max,
      reason: "Commute not calculated — no valid route result available yet.",
      sourceConfidence: "UNKNOWN",
      completeness: 0,
      notCalculated: true,
    };
  }

  const ratio = commute.durationMinutes / profile.maxCommuteMinutes;
  const factor =
    ratio <= 2 / 3 ? 1 : ratio <= 1 ? 0.7 : ratio <= 7 / 6 ? 0.35 : 0;
  const isMock = commute.provider.toLowerCase() === "mock";
  const cappedFactor = isMock ? Math.min(factor, 0.5) : factor;
  return {
    key: "commute",
    label: "Commute",
    points: round(max * cappedFactor),
    max,
    reason: `${commute.durationMinutes} min vs ${profile.maxCommuteMinutes} min maximum${isMock ? "; approximate mock capped at 50%" : ""}.`,
    sourceConfidence: isMock ? "ESTIMATE" : "EXACT",
    completeness: 100,
  };
}

function scoreLayout(
  listing: ScoreListingInput,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  const separateKnown = listing.hasSeparateBedroom !== "UNKNOWN";
  const roomsKnown = listing.rooms !== null;
  const complete = percent(
    Number(roomsKnown) +
      Number(!profile.requireSeparateBedroom || separateKnown),
    2,
  );
  const roomsOk = roomsKnown && listing.rooms! >= profile.minRooms;
  const separateOk =
    !profile.requireSeparateBedroom || listing.hasSeparateBedroom === "YES";
  return {
    key: "layout",
    label: "Layout / separate bedroom",
    points: roomsOk && separateOk ? max : 0,
    max,
    reason: !roomsKnown
      ? "Room count is unknown."
      : !separateKnown && profile.requireSeparateBedroom
        ? "Separate bedroom is not confirmed."
        : roomsOk && separateOk
          ? "Confirmed layout meets the profile requirements."
          : "Confirmed layout does not meet the profile requirements.",
    sourceConfidence: complete === 100 ? "EXACT" : "UNKNOWN",
    completeness: complete,
  };
}

function scoreCondition(
  listing: ScoreListingInput,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  const signals: { known: boolean; positive: boolean; label: string }[] = [
    {
      known: listing.newerOrRenovatedSignal !== "UNKNOWN",
      positive: listing.newerOrRenovatedSignal === "YES",
      label: "newer/renovated",
    },
    {
      known: listing.airConditioning !== "UNKNOWN",
      positive: listing.airConditioning === "YES",
      label: "air conditioning",
    },
    {
      known: listing.balcony !== "UNKNOWN",
      positive: listing.balcony === "YES",
      label: "balcony/loggia",
    },
    {
      known: listing.elevator !== "UNKNOWN",
      positive: listing.elevator === "YES",
      label: "elevator",
    },
    {
      known: listing.storage !== "UNKNOWN",
      positive: listing.storage === "YES",
      label: "storage cellar",
    },
  ];
  if (profile.needsFittedKitchen) {
    signals.push({
      known: listing.kitchen !== "UNKNOWN",
      positive: listing.kitchen === "FITTED",
      label: "fitted kitchen",
    });
  }
  if (profile.needsWashingMachine) {
    signals.push({
      known: listing.washingMachine !== "UNKNOWN",
      positive: listing.washingMachine === "MACHINE_INCLUDED",
      label: "washing machine",
    });
  }
  const confirmed = signals.filter((signal) => signal.positive);
  const known = signals.filter((signal) => signal.known).length;
  return {
    key: "condition",
    label: "Condition & amenities",
    points: round(max * (confirmed.length / signals.length)),
    max,
    reason:
      confirmed.length > 0
        ? `Confirmed: ${confirmed.map((signal) => signal.label).join(", ")}.`
        : "No desired amenity is confirmed.",
    sourceConfidence: known === signals.length ? "EXACT" : "UNKNOWN",
    completeness: percent(known, signals.length),
  };
}

function scoreParking(listing: ScoreListingInput, max: number): ScoreCategory {
  const factor: Record<NormalizedListing["parkingAvailability"], number> = {
    INCLUDED: 1,
    AVAILABLE_EXTRA_COST: 0.6,
    NONE: 0,
    UNKNOWN: 0,
  };
  const reason: Record<NormalizedListing["parkingAvailability"], string> = {
    INCLUDED: "Parking included.",
    AVAILABLE_EXTRA_COST: "Parking available at extra cost.",
    NONE: "No parking available.",
    UNKNOWN: "Parking availability unconfirmed.",
  };
  const known = listing.parkingAvailability !== "UNKNOWN";
  return {
    key: "parking",
    label: "Parking availability",
    points: round(max * factor[listing.parkingAvailability]),
    max,
    reason: reason[listing.parkingAvailability],
    sourceConfidence: known ? "EXACT" : "UNKNOWN",
    completeness: known ? 100 : 0,
  };
}

function scoreMoveIn(
  listing: ScoreListingInput,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  if (!listing.availabilityDate) {
    return {
      key: "moveIn",
      label: "Move-in timing",
      points: 0,
      max,
      reason: "No availability date given.",
      sourceConfidence: "UNKNOWN",
      completeness: 0,
    };
  }
  const date = listing.availabilityDate.getTime();
  const earliest = profile.moveInEarliest.getTime();
  const latest = profile.moveInLatest.getTime();
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  const inside = date >= earliest && date <= latest;
  const close = date >= earliest - twoWeeks && date <= latest + twoWeeks;
  return {
    key: "moveIn",
    label: "Move-in timing",
    points: inside ? max : close ? round(max * 0.5) : 0,
    max,
    reason: inside
      ? "Availability date matches the desired window."
      : close
        ? "Availability is close to the desired window."
        : "Availability is outside the desired window.",
    sourceConfidence: "EXACT",
    completeness: 100,
  };
}

function scoreContract(
  cost: CostBreakdown,
  listing: ScoreListingInput,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  const share = max / (profile.preferNoCommission ? 4 : 3);
  let points = 0;
  const notes: string[] = [];
  const known = [
    listing.contractType !== "UNKNOWN",
    !cost.unknownUpfrontFields.includes("contractFee"),
    !cost.unknownUpfrontFields.includes("deposit"),
  ];
  if (profile.preferNoCommission) {
    known.push(!cost.unknownUpfrontFields.includes("commission"));
  }

  if (listing.contractType === "UNLIMITED") points += share;
  else if (listing.contractType === "FIXED_TERM") points += share * 0.6;
  else if (listing.contractType === "TEMPORARY" && !profile.longTermOnly)
    points += share * 0.2;
  else if (listing.contractType === "UNKNOWN")
    notes.push("contract type unknown");

  if (profile.preferNoCommission) {
    if (cost.upfrontCost.commission === 0) points += share;
    else if (cost.upfrontCost.commission === null)
      notes.push("commission unknown");
    else notes.push("agent commission charged");
  }

  if (cost.upfrontCost.contractFee === 0) points += share;
  else if (cost.upfrontCost.contractFee === null)
    notes.push("contract fee unknown");
  else notes.push("contract fee charged");

  if (
    cost.upfrontCost.deposit !== null &&
    !cost.redFlags.includes("HIGH_DEPOSIT")
  )
    points += share;
  else if (cost.upfrontCost.deposit === null) notes.push("deposit unknown");
  else notes.push("deposit exceeds three all-in months");

  const confidenceValues = [
    cost.upfrontCost.contractFeeConfidence,
    cost.upfrontCost.depositConfidence,
  ];
  if (profile.preferNoCommission)
    confidenceValues.push(cost.upfrontCost.commissionConfidence);
  const sourceConfidence: FinancialConfidence = known.every(Boolean)
    ? confidenceValues.includes("ESTIMATE")
      ? "ESTIMATE"
      : "EXACT"
    : "UNKNOWN";
  return {
    key: "contract",
    label: "Contract / fees / deposit",
    points: round(clamp(points, 0, max)),
    max,
    reason:
      notes.length > 0
        ? notes.join("; ")
        : "Contract and upfront charges are confirmed and acceptable.",
    sourceConfidence,
    completeness: percent(known.filter(Boolean).length, known.length),
  };
}

function scoreInfrastructure(
  listing: ScoreListingInput,
  profile: ScoreProfileInput,
  max: number,
): ScoreCategory {
  let points = 0;
  const notes: string[] = [];
  if (listing.quietCourtyardSignal === "YES") {
    points += max * 0.5;
    notes.push("quiet courtyard-facing orientation confirmed");
  }
  if (listing.district !== null) {
    if (profile.preferredDistricts.includes(listing.district)) {
      points += max * 0.5;
      notes.push(`district ${listing.district} is preferred`);
    } else if (profile.secondaryDistricts.includes(listing.district)) {
      points += max * 0.25;
      notes.push(`district ${listing.district} is secondary`);
    }
  }
  const known =
    Number(listing.quietCourtyardSignal !== "UNKNOWN") +
    Number(listing.district !== null) +
    Number(hasKnownCity(listing.city));
  return {
    key: "infrastructure",
    label: "Infrastructure & quietness",
    points: round(clamp(points, 0, max)),
    max,
    reason:
      notes.length > 0
        ? notes.join("; ")
        : "No desired location or quietness signal is confirmed.",
    sourceConfidence: known === 3 ? "EXACT" : "UNKNOWN",
    completeness: percent(known, 3),
  };
}

function hardViolation(
  listing: ScoreListingInput,
  cost: CostBreakdown,
  profile: ScoreProfileInput,
): string | null {
  if (listing.listingType === "SHARED_ROOM")
    return "Shared apartment / WG room.";
  if (listing.listingType === "SALE") return "Purchase listing, not a rental.";
  const cityKnown = hasKnownCity(listing.city);
  if (cityKnown && !isViennaLocation(listing.city))
    return "Not located in Vienna.";
  if (profile.longTermOnly && listing.contractType === "TEMPORARY")
    return "Temporary contract violates the long-term requirement.";
  if (profile.requireSeparateBedroom && listing.hasSeparateBedroom === "NO")
    return "No separate bedroom.";
  if (listing.rooms !== null && listing.rooms < profile.minRooms)
    return `Only ${listing.rooms} rooms; at least ${profile.minRooms} required.`;
  if (
    profile.needsFittedKitchen &&
    listing.kitchen !== "UNKNOWN" &&
    listing.kitchen !== "FITTED"
  )
    return "No fitted kitchen.";
  if (
    profile.needsWashingMachine &&
    listing.washingMachine !== "UNKNOWN" &&
    listing.washingMachine !== "MACHINE_INCLUDED"
  )
    return "No washing machine included.";
  if (profile.parkingRequired && listing.parkingAvailability === "NONE")
    return "No parking available.";
  if (cost.monthlyKnownCost > profile.absoluteMonthlyMax)
    return "All-in monthly cost exceeds the absolute maximum.";
  return null;
}

export function computeScore(
  listing: ScoreListingInput,
  cost: CostBreakdown,
  commute: CommuteInput | null,
  profile: ScoreProfileInput,
): ScoreResult {
  const weights = scoringWeights.parse(profile.weights);
  if (!isValidCommuteDuration(profile.maxCommuteMinutes))
    throw new RangeError("maxCommuteMinutes must be greater than zero");

  const categories: ScoreCategory[] = [
    scoreBudget(cost, profile, weights.budget),
    scoreCommute(commute, profile, weights.commute),
    scoreLayout(listing, profile, weights.layout),
    scoreCondition(listing, profile, weights.condition),
    scoreParking(listing, weights.parking),
    scoreMoveIn(listing, profile, weights.moveIn),
    scoreContract(cost, listing, profile, weights.contract),
    scoreInfrastructure(listing, profile, weights.infrastructure),
  ];
  const dataCompleteness = Math.round(
    categories.reduce(
      (sum, category) => sum + category.max * (category.completeness / 100),
      0,
    ),
  );
  const zeroReason = hardViolation(listing, cost, profile);
  if (zeroReason) {
    return {
      totalScore: 0,
      dataCompleteness: clamp(dataCompleteness, 0, 100),
      isZeroed: true,
      zeroReason,
      categories: categories.map((category) => ({
        ...category,
        points: 0,
        reason: `Excluded: ${zeroReason}`,
      })),
    };
  }

  return {
    totalScore: clamp(
      Math.round(
        categories.reduce((sum, category) => sum + category.points, 0),
      ),
      0,
      100,
    ),
    dataCompleteness: clamp(dataCompleteness, 0, 100),
    isZeroed: false,
    zeroReason: null,
    categories,
  };
}
