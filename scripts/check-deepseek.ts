import assert from "node:assert/strict";
import { extractMoneyFieldsWithAI } from "../src/providers/shared/ai-extract";

async function main() {
  assert.equal(
    process.env.AI_EXTRACTION_ENABLED,
    "true",
    "AI_EXTRACTION_ENABLED must be true",
  );
  const apiKey = process.env.DEEPSEEK_API_KEY;
  assert.ok(apiKey, "DEEPSEEK_API_KEY is missing");
  const modelsResponse = await fetch("https://api.deepseek.com/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  assert.ok(
    modelsResponse.ok,
    `DeepSeek authentication failed with status ${modelsResponse.status}`,
  );

  const text =
    "Die monatliche Miete beträgt EUR 1.200. Die Kaution beträgt EUR 3.600.";
  const facts = await extractMoneyFieldsWithAI(text, ["baseRent", "deposit"]);

  assert.equal(facts.baseRent?.amount, 1_200, "DeepSeek missed the base rent");
  assert.equal(
    facts.baseRent?.confidence,
    "ESTIMATE",
    "DeepSeek returned an invalid base-rent confidence",
  );
  assert.equal(facts.deposit?.amount, 3_600, "DeepSeek missed the deposit");
  assert.equal(
    facts.deposit?.confidence,
    "ESTIMATE",
    "DeepSeek returned an invalid deposit confidence",
  );

  console.log(
    JSON.stringify({
      ok: true,
      model: "deepseek-v4-flash",
      fields: {
        baseRent: facts.baseRent,
        deposit: facts.deposit,
      },
    }),
  );
}

void main();
