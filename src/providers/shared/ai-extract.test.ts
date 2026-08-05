import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    AI_EXTRACTION_ENABLED: "true",
    DEEPSEEK_API_KEY: "test-key",
  },
  profile: { aiExtractionEnabled: true },
  generateText: vi.fn(),
  model: vi.fn(() => "deepseek-model"),
}));

vi.mock("@/lib/env", () => ({ getEnv: () => mocks.env }));
vi.mock("@/server/current-user", () => ({
  getOwnerUser: async () => ({ id: "owner" }),
  getActiveSearchProfile: async () => mocks.profile,
}));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => mocks.model,
}));
vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: { object: (value: unknown) => value },
}));

import { extractMoneyFieldsWithAI, fillUnknownMoneyFacts } from "./ai-extract";

describe("extractMoneyFieldsWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.AI_EXTRACTION_ENABLED = "true";
    mocks.env.DEEPSEEK_API_KEY = "test-key";
    mocks.profile.aiExtractionEnabled = true;
  });

  it("accepts only ESTIMATE/UNKNOWN facts and rejects EXACT", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        baseRent: {
          amount: 1_200,
          confidence: "ESTIMATE",
          sourceText: "Miete EUR 1.200",
        },
        deposit: { amount: null, confidence: "UNKNOWN", sourceText: null },
      },
    });

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent", "deposit"]),
    ).resolves.toEqual({
      baseRent: {
        amount: 1_200,
        confidence: "ESTIMATE",
        sourceText: "Miete EUR 1.200",
      },
      deposit: { amount: null, confidence: "UNKNOWN", sourceText: null },
    });

    mocks.generateText.mockResolvedValueOnce({
      output: {
        baseRent: {
          amount: 1_200,
          confidence: "EXACT",
          sourceText: "Miete EUR 1.200",
        },
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});
  });

  it("returns an empty object when the SDK throws", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("DeepSeek unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});
  });

  it("rejects an estimate whose quote or amount is not in the input", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        baseRent: {
          amount: 1_300,
          confidence: "ESTIMATE",
          sourceText: "Miete EUR 1.200",
        },
      },
    });

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});

    mocks.generateText.mockResolvedValueOnce({
      output: {
        baseRent: {
          amount: 1_200,
          confidence: "ESTIMATE",
          sourceText: "Monthly rent EUR 1.200",
        },
      },
    });

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});
  });

  it("accepts English thousands separators in direct evidence", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        advertisedMonthlyTotal: {
          amount: 1_190,
          confidence: "ESTIMATE",
          sourceText: "Total rent EUR 1,190",
        },
      },
    });

    await expect(
      extractMoneyFieldsWithAI("Total rent EUR 1,190", [
        "advertisedMonthlyTotal",
      ]),
    ).resolves.toMatchObject({
      advertisedMonthlyTotal: { amount: 1_190, confidence: "ESTIMATE" },
    });
  });

  it("does not call the SDK when extraction is disabled", async () => {
    mocks.env.AI_EXTRACTION_ENABLED = "false";

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("does not call the SDK when the API key is missing", async () => {
    mocks.env.DEEPSEEK_API_KEY = "";

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("does not call the SDK when the Settings toggle is off, even with the env var enabled", async () => {
    mocks.profile.aiExtractionEnabled = false;

    await expect(
      extractMoneyFieldsWithAI("Miete EUR 1.200", ["baseRent"]),
    ).resolves.toEqual({});
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});

describe("fillUnknownMoneyFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.AI_EXTRACTION_ENABLED = "true";
    mocks.env.DEEPSEEK_API_KEY = "test-key";
    mocks.profile.aiExtractionEnabled = true;
  });

  it("only requests fields that are still unknown", async () => {
    const knownExceptDeposit = Object.fromEntries(
      [
        "advertisedMonthlyTotal",
        "baseRent",
        "operatingCosts",
        "heatingCost",
        "hotWaterCost",
        "electricityEstimate",
        "internetEstimate",
        "parkingMonthlyCost",
        "commission",
        "contractFee",
      ].map((field) => [
        field,
        { amount: 1, confidence: "EXACT" as const, sourceText: "x" },
      ]),
    );
    mocks.generateText.mockResolvedValueOnce({
      output: {
        deposit: {
          amount: 2_400,
          confidence: "ESTIMATE",
          sourceText: "Kaution 2.400",
        },
      },
    });

    const result = await fillUnknownMoneyFacts(
      knownExceptDeposit,
      "Miete 720. Kaution 2.400.",
    );

    expect(result).toEqual({
      deposit: {
        amount: 2_400,
        confidence: "ESTIMATE",
        sourceText: "Kaution 2.400",
      },
    });
    const requestedFields = mocks.generateText.mock.calls[0][0]
      .prompt as string;
    expect(requestedFields).toBe(
      "Requested fields: deposit\n\nInput text:\nMiete 720. Kaution 2.400.",
    );
  });

  it("skips the SDK call when no field is unknown", async () => {
    const allKnown = Object.fromEntries(
      [
        "advertisedMonthlyTotal",
        "baseRent",
        "operatingCosts",
        "heatingCost",
        "hotWaterCost",
        "electricityEstimate",
        "internetEstimate",
        "parkingMonthlyCost",
        "deposit",
        "commission",
        "contractFee",
      ].map((field) => [
        field,
        { amount: 1, confidence: "EXACT" as const, sourceText: "x" },
      ]),
    );

    await expect(
      fillUnknownMoneyFacts(allKnown, "irrelevant text"),
    ).resolves.toEqual({});
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("skips the SDK call when there is no text to extract from", async () => {
    await expect(fillUnknownMoneyFacts({}, null)).resolves.toEqual({});
    await expect(fillUnknownMoneyFacts({}, "   ")).resolves.toEqual({});
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
