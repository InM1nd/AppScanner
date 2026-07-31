// Small parsing helpers shared by the real-fetch site adapters (Willhaben,
// ImmoScout24.at): Austrian-format euro amounts, and best-effort German
// keyword detection for facts the site doesn't expose as a clean field.

import * as cheerio from "cheerio";
import type { ContractType, HeatingType, TriState } from "@/types/enums";

// "4.878,69 €" / "386,03" / "13500" -> 4878.69 / 386.03 / 13500
export function parseEuroAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
  return text || null;
}

// ponytail: keyword-in-text heuristic — a phrase like "kein Balkon" would
// false-positive as YES. Good enough for a personal-use draft the user
// reviews before saving; upgrade to a structured per-site field if that bites.
export function detectAmenitySignal(
  text: string | null | undefined,
  keywords: string[],
): TriState {
  if (!text) return "UNKNOWN";
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k)) ? "YES" : "UNKNOWN";
}

export function detectHeatingType(
  text: string | null | undefined,
): HeatingType {
  if (!text) return "UNKNOWN";
  const lower = text.toLowerCase();
  if (lower.includes("fernwärme")) return "DISTRICT";
  if (lower.includes("fußbodenheizung")) return "FLOOR";
  if (lower.includes("gasheizung") || lower.includes("gasetagenheizung"))
    return "GAS";
  if (lower.includes("elektroheizung") || lower.includes("nachtspeicher"))
    return "ELECTRIC";
  if (lower.includes("heizung")) return "OTHER";
  return "UNKNOWN";
}

export function detectContractType(
  text: string | null | undefined,
): ContractType {
  if (!text) return "UNKNOWN";
  const lower = text.toLowerCase();
  if (lower.includes("unbefristet")) return "UNLIMITED";
  if (lower.includes("befristet") || /\d+\s*jahr/.test(lower))
    return "FIXED_TERM";
  return "UNKNOWN";
}
