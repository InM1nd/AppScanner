import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as digest } from "./daily-digest/route";
import { POST as recompute } from "./recompute-all/route";
import { POST as commutes } from "./recalculate-commutes/route";
import { POST as crawl } from "./search-crawler/route";
import { POST as refresh } from "./refresh-listings/route";

describe("direct job routes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([crawl, refresh, digest, recompute, commutes])(
    "is unavailable in production",
    async (handler) => {
      vi.stubEnv("NODE_ENV", "production");
      const response = await handler();
      expect(response.status).toBe(404);
    },
  );
});
