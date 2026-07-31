import { describe, expect, it } from "vitest";
import { assertE2EDatabaseUrl } from "./assert-e2e-database";

describe("assertE2EDatabaseUrl", () => {
  it("accepts a dedicated E2E PostgreSQL database", () => {
    expect(() =>
      assertE2EDatabaseUrl(
        "postgresql://user:pass@localhost:5432/appscanner_e2e",
      ),
    ).not.toThrow();
  });

  it.each([
    undefined,
    "not-a-url",
    "postgresql://user:pass@localhost:5432/appscanner",
  ])("rejects unsafe DATABASE_URL %s", (url) =>
    expect(() => assertE2EDatabaseUrl(url)).toThrow(),
  );
});
