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
    : /^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, "")
      : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
  return text || null;
}

export function detectAmenitySignal(
  text: string | null | undefined,
  keywords: string[],
): TriState {
  if (!text) return "UNKNOWN";
  const lower = text.toLowerCase();
  if (
    keywords.some((keyword) =>
      ["no ", "without ", "kein ", "keine ", "ohne "].some((prefix) =>
        lower.includes(`${prefix}${keyword}`),
      ),
    )
  )
    return "NO";
  return keywords.some((k) => lower.includes(k)) ? "YES" : "UNKNOWN";
}

export function detectHeatingType(
  text: string | null | undefined,
): HeatingType {
  if (!text) return "UNKNOWN";
  const lower = text.toLowerCase();
  if (lower.includes("fernwärme") || lower.includes("district heating"))
    return "DISTRICT";
  if (lower.includes("fußbodenheizung") || lower.includes("floor heating"))
    return "FLOOR";
  if (
    lower.includes("gasheizung") ||
    lower.includes("gasetagenheizung") ||
    lower.includes("gas heating")
  )
    return "GAS";
  if (
    lower.includes("elektroheizung") ||
    lower.includes("nachtspeicher") ||
    lower.includes("electric heating")
  )
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

// A source page confirming its own listing is gone/taken without a real
// HTTP 404/410 — Willhaben (and others) render a normal 200 page with a
// "no longer available" notice instead of erroring, so the structural
// (missing JSON-LD/advertDetails) checks each parser already has don't
// catch it. Checked against the raw fetched HTML, not just the extracted
// description, since the notice usually isn't inside any structured field.
// ponytail: keyword patterns, not exhaustive — extend when a real page
// slips through with different wording; a missed match just falls back to
// parsing the page normally (safe direction to be wrong in).
const GONE_SIGNAL_PATTERN =
  /nicht mehr verf[üu]gbar|anzeige (?:wurde |ist )?(?:deaktiviert|inaktiv)|inserat (?:ist )?nicht mehr (?:aktiv|verf[üu]gbar)|is no longer available|listing (?:has been |is )?removed/i;
const RESERVED_SIGNAL_PATTERN =
  /bereits (?:reserviert|vermietet|vergeben)|objekt (?:ist )?reserviert|already (?:reserved|rented)/i;

export function detectSourceUnavailableSignal(
  text: string | null | undefined,
): "GONE" | "RESERVED" | null {
  if (!text) return null;
  if (GONE_SIGNAL_PATTERN.test(text)) return "GONE";
  if (RESERVED_SIGNAL_PATTERN.test(text)) return "RESERVED";
  return null;
}

export function detectSourceUnavailableSignalFromHtml(
  html: string | null | undefined,
): "GONE" | "RESERVED" | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  $("script, style, noscript, template").remove();
  return detectSourceUnavailableSignal($.root().text());
}
