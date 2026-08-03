import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractMoneyFieldsWithAI: vi.fn(),
  fetchHtml: vi.fn(),
}));

vi.mock("./shared/fetch-html", () => ({ fetchHtml: mocks.fetchHtml }));
vi.mock("./shared/ai-extract", () => ({
  extractMoneyFieldsWithAI: mocks.extractMoneyFieldsWithAI,
  isAiExtractionEnabled: () => true,
}));

import { genericUrlProvider } from "./generic-url";

describe("genericUrlProvider AI money extraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges AI fields without overriding metadata base rent", async () => {
    mocks.fetchHtml.mockResolvedValue(`
      <html><body>Betriebskosten EUR 180</body>
      <script type="application/ld+json">
        {"offers":{"price":1200,"priceCurrency":"EUR"}}
      </script></html>
    `);
    mocks.extractMoneyFieldsWithAI.mockResolvedValue({
      operatingCosts: {
        amount: 180,
        confidence: "ESTIMATE",
        sourceText: "Betriebskosten EUR 180",
      },
    });

    const listing = await genericUrlProvider.importFromUrl(
      "https://example.test/listing/1",
    );

    expect(listing.baseRent).toMatchObject({
      amount: 1200,
      confidence: "ESTIMATE",
    });
    expect(listing.operatingCosts).toEqual({
      amount: 180,
      confidence: "ESTIMATE",
      sourceText: "Betriebskosten EUR 180",
    });
    expect(mocks.extractMoneyFieldsWithAI.mock.calls[0][1]).not.toContain(
      "baseRent",
    );
  });
});
