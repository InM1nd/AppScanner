"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "settings";
}) {
  const { theme, setTheme } = useTheme();
  // Theme is only known on the client — render the unselected state on the
  // server so hydration matches.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div
      className={cn(
        "inline-flex rounded-md border p-0.5 text-xs font-medium",
        variant === "sidebar" ? "border-sidebar-border" : "border-border",
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mounted && theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-label={opt.label}
            aria-pressed={active}
            className={cn(
              "flex items-center justify-center rounded-sm px-2 py-1 transition-colors",
              active
                ? variant === "sidebar"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "bg-accent text-accent-foreground"
                : variant === "sidebar"
                  ? "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
