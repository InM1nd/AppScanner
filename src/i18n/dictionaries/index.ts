import en, { type Dictionary } from "./en";
import ru from "./ru";
import type { Locale } from "../config";

export const dictionaries: Record<Locale, Dictionary> = { en, ru };
