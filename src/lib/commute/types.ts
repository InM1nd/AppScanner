export interface LatLng {
  lat: number;
  lng: number;
}

export interface CommuteResult {
  provider: string;
  durationMinutes: number;
  walkingMinutes: number | null;
  transfers: number | null;
  routeSummary: string;
}

// Never fabricate a duration: return null when no real route could be
// computed rather than guessing. The caller renders "commute not
// calculated" for a null result.
export interface RoutingProvider {
  name: string;
  computeCommute(
    origin: LatLng,
    destination: LatLng,
  ): Promise<CommuteResult | null>;
}
