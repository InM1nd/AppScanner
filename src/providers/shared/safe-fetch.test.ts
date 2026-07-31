import { describe, expect, it, vi } from "vitest";
import {
  assertSafePublicUrl,
  isPublicAddress,
  safeFetchText,
} from "./safe-fetch";

const resolvePublic = async () => ["93.184.216.34"];

describe("safe provider fetch", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("blocks non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it("blocks private DNS results and non-HTTP URLs", async () => {
    await expect(
      assertSafePublicUrl("https://example.test", {
        resolveHost: async () => ["10.0.0.2"],
      }),
    ).rejects.toThrow(/private/);
    await expect(assertSafePublicUrl("file:///etc/passwd")).rejects.toThrow(
      /HTTP/,
    );
  });

  it("enforces provider-domain allowlists", async () => {
    await expect(
      assertSafePublicUrl("https://evil.example/listing", {
        allowedHosts: ["willhaben.at"],
        resolveHost: resolvePublic,
      }),
    ).rejects.toThrow(/not allowed/);
  });

  it("revalidates a redirect before making the redirected request", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        }),
    );

    await expect(
      safeFetchText("https://example.test", {
        fetchImpl,
        resolveHost: resolvePublic,
      }),
    ).rejects.toThrow(/private/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects non-HTML and oversized responses", async () => {
    await expect(
      safeFetchText("https://example.test", {
        fetchImpl: async () =>
          new Response("{}", {
            headers: { "content-type": "application/json" },
          }),
        resolveHost: resolvePublic,
      }),
    ).rejects.toThrow(/content type/);

    await expect(
      safeFetchText("https://example.test", {
        fetchImpl: async () =>
          new Response("0123456789", {
            headers: { "content-type": "text/html" },
          }),
        maxBytes: 5,
        resolveHost: resolvePublic,
      }),
    ).rejects.toThrow(/exceeds/);
  });

  it("returns a bounded public HTML response", async () => {
    const html = await safeFetchText("https://example.test/listing", {
      allowedHosts: ["example.test"],
      fetchImpl: async () =>
        new Response("<title>Listing</title>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      resolveHost: resolvePublic,
    });
    expect(html).toContain("Listing");
  });
});
