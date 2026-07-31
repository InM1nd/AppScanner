// Deterministic, clearly-labeled mock so the app is fully usable in local
// development with no API key. Never presented as a real transit result —
// provider name is always "mock" and the UI must show that verbatim.

import type { LatLng, RoutingProvider } from "./types";

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ponytail: flat average-speed heuristic (Vienna public transit + walking,
// ~18km/h effective incl. wait/transfer time) plus a fixed 6min access/egress
// walk. Good enough for dev; swap for the real provider for anything
// decision-grade.
const AVERAGE_EFFECTIVE_SPEED_KMH = 18;
const FIXED_ACCESS_EGRESS_MINUTES = 6;

export const mockRoutingProvider: RoutingProvider = {
  name: "mock",

  async computeCommute(origin, destination) {
    const distanceKm = haversineKm(origin, destination);
    const rideMinutes = (distanceKm / AVERAGE_EFFECTIVE_SPEED_KMH) * 60;
    const durationMinutes = Math.round(
      rideMinutes + FIXED_ACCESS_EGRESS_MINUTES,
    );
    const transfers = distanceKm > 4 ? 1 : 0;

    return {
      provider: "mock",
      durationMinutes,
      walkingMinutes: FIXED_ACCESS_EGRESS_MINUTES,
      transfers,
      routeSummary: `Mock estimate: ~${distanceKm.toFixed(1)} km straight-line, not a real transit route.`,
    };
  },
};
