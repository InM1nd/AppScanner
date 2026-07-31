// Real adapter using Google's Routes API (transit mode). Migrated from the
// legacy Directions API: Google blocks legacy Maps APIs entirely on Cloud
// projects created after their cutoff date, regardless of what "Enabled" /
// key-restriction state the console shows — see
// developers.google.com/maps/legacy. Routes API is the only endpoint
// guaranteed to work on a new project. Only active when ROUTING_PROVIDER=google
// and GOOGLE_MAPS_API_KEY is set — using your own key against Google's
// official endpoint is a lawful integration, not scraping. Returns null on
// any failure or "no route found" rather than inventing a number.

import type { LatLng, RoutingProvider } from "./types";

interface RouteStep {
  travelMode?: string;
  staticDuration?: string;
  transitDetails?: { transitLine?: { nameShort?: string } };
}

interface RoutesResponse {
  routes?: { duration?: string; legs?: { steps?: RouteStep[] }[] }[];
}

// Routes API durations are strings like "2163s".
function parseSeconds(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

const FIELD_MASK =
  "routes.duration,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails.transitLine.nameShort";

export const googleRoutingProvider: RoutingProvider = {
  name: "google",

  async computeCommute(origin: LatLng, destination: LatLng) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;

    let data: RoutesResponse;
    try {
      const res = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: { latitude: origin.lat, longitude: origin.lng },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.lat,
                  longitude: destination.lng,
                },
              },
            },
            travelMode: "TRANSIT",
          }),
        },
      );
      if (!res.ok) return null;
      data = await res.json();
    } catch {
      return null;
    }

    const route = data.routes?.[0];
    const steps = route?.legs?.[0]?.steps;
    if (!route?.duration || !steps) return null;

    const durationSeconds = parseSeconds(route.duration);
    if (durationSeconds === null) return null;
    const durationMinutes = Math.round(durationSeconds / 60);
    if (durationMinutes <= 0) return null;
    const walkingSeconds = steps
      .filter((s) => s.travelMode === "WALK")
      .reduce((sum, s) => sum + (parseSeconds(s.staticDuration) ?? 0), 0);
    const transitSteps = steps.filter((s) => s.travelMode === "TRANSIT");
    const lines = transitSteps
      .map((s) => s.transitDetails?.transitLine?.nameShort)
      .filter((v): v is string => Boolean(v));

    return {
      provider: "google",
      durationMinutes,
      walkingMinutes: Math.round(walkingSeconds / 60),
      transfers: Math.max(0, transitSteps.length - 1),
      routeSummary:
        lines.length > 0 ? lines.join(" → ") : "Transit route via Google Maps.",
    };
  },
};
