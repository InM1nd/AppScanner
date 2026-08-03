import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    AI_EXTRACTION_ENABLED: "true",
    DEEPSEEK_API_KEY: "test-key",
  },
  generateText: vi.fn(),
  model: vi.fn(() => "deepseek-model"),
}));

vi.mock("@/lib/env", () => ({ getEnv: () => mocks.env }));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => mocks.model,
}));
vi.mock("ai", () => ({
  generateText: mocks.generateText,
  Output: { object: (value: unknown) => value },
}));

import { extractMoneyFieldsWithAI } from "./ai-extract";

describe("extractMoneyFieldsWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.AI_EXTRACTION_ENABLED = "true";
    mocks.env.DEEPSEEK_API_KEY = "test-key";
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
});
