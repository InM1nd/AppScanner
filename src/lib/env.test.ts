import { describe, expect, it } from "vitest";
import { getEnv } from "./env";

describe("environment validation", () => {
  it("keeps test/development defaults lazy", () => {
    const env = getEnv({ NODE_ENV: "test" });
    expect(env.SCRAPER_MIN_DELAY_MS).toBe(4_000);
    expect(env.APP_TIME_ZONE).toBe("Europe/Vienna");
  });

  it("requires dependent secrets only when their features are enabled", () => {
    expect(() =>
      getEnv({ NODE_ENV: "test", TELEGRAM_ENABLED: "true" }),
    ).toThrow(/TELEGRAM_BOT_TOKEN/);
    expect(() =>
      getEnv({ NODE_ENV: "test", ROUTING_PROVIDER: "google" }),
    ).toThrow(/GOOGLE_MAPS_API_KEY/);
  });

  it("requires the production trust-boundary configuration", () => {
    expect(() => getEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });
});
