"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-context";
import { setLocaleAction } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "ru", label: "RU" },
];

export function LanguageSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "settings";
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border p-0.5 text-xs font-medium",
        variant === "sidebar" && "border-sidebar-border",
      )}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          disabled={pending}
          onClick={() => change(opt.value)}
          className={cn(
            "px-2 py-1 rounded-sm transition-colors",
            locale === opt.value
              ? variant === "sidebar"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "bg-accent text-accent-foreground"
              : variant === "sidebar"
                ? "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
