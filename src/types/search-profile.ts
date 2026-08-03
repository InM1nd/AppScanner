import { z } from "zod";

export const scoringWeights = z
  .object({
    budget: z.number().finite().nonnegative(),
    commute: z.number().finite().nonnegative(),
    layout: z.number().finite().nonnegative(),
    condition: z.number().finite().nonnegative(),
    parking: z.number().finite().nonnegative(),
    moveIn: z.number().finite().nonnegative(),
    contract: z.number().finite().nonnegative(),
    infrastructure: z.number().finite().nonnegative(),
  })
  .refine(
    (weights) =>
      Math.abs(
        Object.values(weights).reduce((sum, value) => sum + value, 0) - 100,
      ) < 0.001,
    {
      message: "Scoring weights must sum to exactly 100",
    },
  );
export type ScoringWeights = z.infer<typeof scoringWeights>;

export const defaultScoringWeights: ScoringWeights = {
  budget: 25,
  commute: 25,
  layout: 15,
  condition: 10,
  parking: 8,
  moveIn: 7,
  contract: 5,
  infrastructure: 5,
};

export const searchProfile = z
  .object({
    city: z.string().trim().min(1).default("Wien"),
    preferredDistricts: z
      .array(z.number().int().min(1).max(23))
      .default([14, 15, 16]),
    secondaryDistricts: z
      .array(z.number().int().min(1).max(23))
      .default([6, 7, 10, 11, 12]),
    workDestinationLat: z.number().finite().min(-90).max(90).default(48.1979),
    workDestinationLng: z.number().finite().min(-180).max(180).default(16.3234),
    workDestinationLabel: z.string().trim().min(1).default("Work"),
    maxCommuteMinutes: z.number().int().positive().default(30),
    requireSeparateBedroom: z.boolean().default(true),
    minRooms: z.number().positive().default(2),
    targetMonthlyMin: z.number().nonnegative().default(900),
    targetMonthlyMax: z.number().positive().default(1000),
    absoluteMonthlyMax: z.number().positive().default(1100),
    energyMonthlyEstimate: z
      .number()
      .finite()
      .nonnegative()
      .max(1000)
      .default(130),
    internetMonthlyEstimate: z
      .number()
      .finite()
      .nonnegative()
      .max(1000)
      .default(30),
    moveInEarliest: z.coerce.date(),
    moveInLatest: z.coerce.date(),
    needsFittedKitchen: z.boolean().default(true),
    needsWashingMachine: z.boolean().default(true),
    parkingRequired: z.boolean().default(false),
    petsAllowed: z.boolean().default(false),
    preferNoCommission: z.boolean().default(true),
    longTermOnly: z.boolean().default(true),
    scoringWeights: scoringWeights.default(defaultScoringWeights),
  })
  .superRefine((profile, ctx) => {
    if (profile.targetMonthlyMin > profile.targetMonthlyMax) {
      ctx.addIssue({
        code: "custom",
        path: ["targetMonthlyMin"],
        message: "Target minimum must not exceed target maximum",
      });
    }
    if (profile.targetMonthlyMax > profile.absoluteMonthlyMax) {
      ctx.addIssue({
        code: "custom",
        path: ["targetMonthlyMax"],
        message: "Target maximum must not exceed absolute maximum",
      });
    }
    if (profile.moveInEarliest > profile.moveInLatest) {
      ctx.addIssue({
        code: "custom",
        path: ["moveInEarliest"],
        message: "Move-in start must not be after move-in end",
      });
    }
  });
export type SearchProfile = z.infer<typeof searchProfile>;
