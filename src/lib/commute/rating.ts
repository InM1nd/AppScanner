import type { CommuteRating } from "@/types/enums";

export function isValidCommuteDuration(durationMinutes: number): boolean {
  return Number.isFinite(durationMinutes) && durationMinutes > 0;
}

export function classifyCommuteRating(
  durationMinutes: number,
  maxCommuteMinutes = 30,
): CommuteRating {
  if (
    !isValidCommuteDuration(durationMinutes) ||
    !isValidCommuteDuration(maxCommuteMinutes)
  ) {
    throw new RangeError(
      "Commute durations must be finite and greater than zero",
    );
  }
  if (durationMinutes <= maxCommuteMinutes * (2 / 3)) return "EXCELLENT";
  if (durationMinutes <= maxCommuteMinutes) return "ACCEPTABLE";
  if (durationMinutes <= maxCommuteMinutes * (7 / 6)) return "WARNING";
  return "POOR";
}
