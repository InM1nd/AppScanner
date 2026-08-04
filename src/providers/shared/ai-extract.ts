import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { MONEY_FIELDS, type MoneyField } from "@/server/listing-mapper";
import type { FinancialFact } from "@/types/listing";
import { parseEuroAmount } from "./text-signals";

const aiFinancialFact = z.discriminatedUnion("confidence", [
  z.object({
    amount: z.number().nonnegative(),
    confidence: z.literal("ESTIMATE"),
    sourceText: z.string().trim().min(1).max(240),
  }),
  z.object({
    amount: z.null(),
    confidence: z.literal("UNKNOWN"),
    sourceText: z.null(),
  }),
]);

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function evidenceAmounts(value: string): number[] {
  return [...value.matchAll(/\d+(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?/g)]
    .map(([raw]) => {
      const compact = raw.replace(/\s/g, "");
      if (/^\d+[.,]\d{3}$/.test(compact))
        return Number(compact.replace(/[.,]/g, ""));
      return parseEuroAmount(compact);
    })
    .filter((amount): amount is number => amount !== null);
}

function hasDirectEvidence(
  input: string,
  fact: { amount: number; confidence: "ESTIMATE"; sourceText: string },
): boolean {
  const inputText = normalizeEvidence(input);
  const sourceText = normalizeEvidence(fact.sourceText);
  return (
    inputText.includes(sourceText) &&
    evidenceAmounts(fact.sourceText).some(
      (amount) => Math.abs(amount - fact.amount) <= 0.01,
    )
  );
}

export function isAiExtractionEnabled(): boolean {
  try {
    const env = getEnv();
    return (
      env.AI_EXTRACTION_ENABLED === "true" && Boolean(env.DEEPSEEK_API_KEY)
    );
  } catch (error) {
    console.error(
      "AI extraction disabled because environment validation failed.",
      error,
    );
    return false;
  }
}

export async function extractMoneyFieldsWithAI(
  text: string,
  fields: readonly MoneyField[],
): Promise<Partial<Record<MoneyField, FinancialFact>>> {
  if (!text.trim() || fields.length === 0 || !isAiExtractionEnabled())
    return {};

  try {
    const env = getEnv();
    const deepseek = createOpenAICompatible({
      name: "deepseek",
      apiKey: env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const schema = z
      .object(
        Object.fromEntries(
          fields.map((field) => [field, aiFinancialFact]),
        ) as Record<MoneyField, typeof aiFinancialFact>,
      )
      .strict();

    const { output } = await generateText({
      model: deepseek("deepseek-v4-flash"),
      output: Output.object({ schema }),
      system: `Extract the requested rental money fields from the input and return JSON only.
Each field must contain amount, confidence, and sourceText. Confidence may only be ESTIMATE or UNKNOWN, never EXACT.
Never fabricate a value. If the text does not clearly state a field, return {"amount":null,"confidence":"UNKNOWN","sourceText":null}.
For ESTIMATE, amount must be the stated EUR amount and sourceText must be a short exact quote from the input that contains that amount.
Do not calculate missing totals or convert one-time amounts into monthly amounts.`,
      prompt: `Requested fields: ${fields.join(", ")}\n\nInput text:\n${text.slice(0, 50_000)}`,
      timeout: { totalMs: 15_000 },
      maxRetries: 2,
    });

    const parsed = schema.parse(output);
    const validated: Partial<Record<MoneyField, FinancialFact>> = {};
    for (const field of fields) {
      const fact = parsed[field];
      if (fact.confidence === "UNKNOWN" || hasDirectEvidence(text, fact))
        validated[field] = fact;
    }
    return validated;
  } catch (error) {
    console.error(
      "AI money extraction failed; using existing heuristics.",
      error,
    );
    return {};
  }
}

// Shared merge step for adapters that already extracted some money facts
// heuristically (structured markup, regex, etc.) and want AI to fill in
// whatever is still unknown. Only requests fields the adapter didn't already
// resolve, so a confirmed EXACT/ESTIMATE fact is never sent to the model to
// begin with — it can't be overridden by construction, not just by convention.
export async function fillUnknownMoneyFacts(
  facts: Partial<Record<MoneyField, FinancialFact>>,
  text: string | null,
): Promise<Partial<Record<MoneyField, FinancialFact>>> {
  if (!text?.trim() || !isAiExtractionEnabled()) return {};
  const unknownFields = MONEY_FIELDS.filter(
    (field) => (facts[field]?.confidence ?? "UNKNOWN") === "UNKNOWN",
  );
  if (unknownFields.length === 0) return {};
  return extractMoneyFieldsWithAI(text, unknownFields);
}
