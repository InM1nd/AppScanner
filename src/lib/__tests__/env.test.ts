import { describe, expect, it } from "vitest";
import { getEnv } from "../env";

describe("environment validation", () => {
  it("treats empty optional secrets as unset", () => {
    const env = getEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "  ",
      INNGEST_EVENT_KEY: "",
      INNGEST_SIGNING_KEY: "",
    });

    expect(env.CLERK_SECRET_KEY).toBeUndefined();
    expect(env.INNGEST_SIGNING_KEY).toBeUndefined();
  });
});
