"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary } from "./dictionaries/en";
import type { Locale } from "./config";

interface LocaleContextValue {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

// Dot-path getter over the dictionary, e.g. t("dashboard.title").
function resolvePath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

export function useTranslations() {
  const ctx = useContext(LocaleContext);
  if (!ctx)
    throw new Error("useTranslations must be used within LocaleProvider");
  const t = (path: string) => {
    const result = resolvePath(ctx.dict, path);
    return typeof result === "string" ? result : path;
  };
  const tList = (path: string): string[] => {
    const result = resolvePath(ctx.dict, path);
    return Array.isArray(result) ? (result as string[]) : [];
  };
  return { t, tList, locale: ctx.locale };
}

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx.locale;
}
