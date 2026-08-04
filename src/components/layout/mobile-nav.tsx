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
import { ThemeToggle } from "./theme-toggle";
import { CommandPaletteTrigger } from "./command-palette";
import { NAV_GROUPS, isNavItemActive } from "./nav-items";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-sidebar-border bg-sidebar/95 backdrop-blur text-sidebar-foreground">
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
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
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
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/65",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          active
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/45",
                        )}
                      />
                      {t(item.key)}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="flex items-center justify-between gap-2 px-4 pb-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
      <span className="text-sm font-semibold flex-1">AppScanner</span>
      <ThemeToggle />
    </div>
  );
}
