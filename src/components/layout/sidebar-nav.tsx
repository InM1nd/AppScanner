"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/locale-context";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { CommandPaletteTrigger } from "./command-palette";
import { NAV_GROUPS, isNavItemActive } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
        <div className="size-8 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/60 flex items-center justify-center text-sidebar-primary-foreground font-bold text-[13px] shadow-sm ring-1 ring-inset ring-white/20">
          AS
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-sm font-semibold tracking-tight">AppScanner</div>
          <div className="text-[11px] text-sidebar-foreground/45 truncate">
            {t("nav.brand")}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <CommandPaletteTrigger />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="space-y-0.5">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-sidebar-foreground/35">
              {t(group.key)}
            </div>
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-sidebar-primary transition-all",
                      active ? "h-5 opacity-100" : "h-0 opacity-0",
                    )}
                  />
                  <Icon
                    className={cn(
                      "size-4 transition-colors",
                      active
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80",
                    )}
                  />
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <p className="text-[11px] leading-snug text-sidebar-foreground/40">
          {t("nav.footer")}
        </p>
      </div>
    </aside>
  );
}
