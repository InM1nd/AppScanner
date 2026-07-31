"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-border bg-sidebar text-sidebar-foreground">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border w-64"
        >
          <SheetTitle className="px-4 pt-4 text-sm">AppScanner</SheetTitle>
          <div className="px-3 pt-2">
            <CommandPaletteTrigger />
          </div>
          <nav className="px-3 py-4 space-y-0.5">
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
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70",
                  )}
                >
                  <Icon className="size-4" />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 pb-4">
            <LanguageSwitcher />
          </div>
        </SheetContent>
      </Sheet>
      <span className="text-sm font-semibold flex-1">AppScanner</span>
      <LanguageSwitcher />
    </div>
  );
}
