import { mockRoutingProvider } from "./mock-provider";
import { googleRoutingProvider } from "./google-provider";
import type { RoutingProvider } from "./types";

export * from "./types";
export { classifyCommuteRating, isValidCommuteDuration } from "./rating";

export function getRoutingProvider(): RoutingProvider {
  return process.env.ROUTING_PROVIDER === "google"
    ? googleRoutingProvider
    : mockRoutingProvider;
}
