import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFetchEvent, NextRequest } from "next/server";
import proxy from "./proxy";

describe("production auth perimeter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when Clerk is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");

    expect(() => proxy({} as NextRequest, {} as NextFetchEvent)).toThrow(
      "Clerk is required in production",
    );
  });
});
