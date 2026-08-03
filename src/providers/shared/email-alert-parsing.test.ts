import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ extractMoneyFieldsWithAI: vi.fn() }));

vi.mock("./ai-extract", () => ({
  extractMoneyFieldsWithAI: mocks.extractMoneyFieldsWithAI,
  isAiExtractionEnabled: () => true,
}));

import { extractListingsFromEmail } from "./email-alert-parsing";

describe("email alert AI money extraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges AI fields without overriding the existing price heuristic", async () => {
    mocks.extractMoneyFieldsWithAI.mockResolvedValue({
      deposit: {
        amount: 3_000,
        confidence: "ESTIMATE",
        sourceText: "Kaution EUR 3.000",
      },
    });
    const url = "https://example.test/listing/123";

    const [listing] = await extractListingsFromEmail(
      `Miete EUR 1250,00, Kaution EUR 3.000 ${url}`,
      /https:\/\/example\.test\/listing\/\d+/,
      /\/listing\/(\d+)/,
    );

    expect(listing.baseRent).toMatchObject({
      amount: 1250,
      confidence: "ESTIMATE",
    });
    expect(listing.deposit).toEqual({
      amount: 3_000,
      confidence: "ESTIMATE",
      sourceText: "Kaution EUR 3.000",
    });
    expect(mocks.extractMoneyFieldsWithAI.mock.calls[0][1]).not.toContain(
      "baseRent",
    );
  });
});
