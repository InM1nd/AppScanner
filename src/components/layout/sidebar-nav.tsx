"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/locale-context";
import { LanguageSwitcher } from "./language-switcher";
import { CommandPaletteTrigger } from "./command-palette";
import {
  LayoutDashboard,
  Building2,
  PlusSquare,
  Columns3,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/listings", key: "nav.listings", icon: Building2 },
  { href: "/import", key: "nav.import", icon: PlusSquare },
  { href: "/compare", key: "nav.compare", icon: Columns3 },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-5 h-16 shrink-0">
        <div className="size-7 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
          AS
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">AppScanner</div>
          <div className="text-[11px] text-sidebar-foreground/50">
            {t("nav.brand")}
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <CommandPaletteTrigger />
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-sidebar-border space-y-2">
        <LanguageSwitcher />
        <p className="text-[11px] text-sidebar-foreground/70">
          {t("nav.footer")}
        </p>
      </div>
    </aside>
  );
}
