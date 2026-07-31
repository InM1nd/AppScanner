"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Building2,
  PlusSquare,
  Columns3,
  Settings,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTranslations } from "@/i18n/locale-context";
import { districtLabel } from "@/lib/format";

interface SearchListing {
  id: string;
  title: string;
  district: number | null;
}

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchListing[]>([]);
  const router = useRouter();
  const { t } = useTranslations();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setResults(data.listings ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const visibleResults = query.trim().length < 2 ? [] : results;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const pages = [
    { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
    { href: "/listings", key: "nav.listings", icon: Building2 },
    { href: "/import", key: "nav.import", icon: PlusSquare },
    { href: "/compare", key: "nav.compare", icon: Columns3 },
    { href: "/settings", key: "nav.settings", icon: Settings },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">{t("nav.search")}</span>
        <kbd className="text-[10px] border border-sidebar-border rounded px-1 py-0.5">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("nav.search")}
        description={t("nav.searchHint")}
      >
        <CommandInput
          placeholder={t("nav.searchHint")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>—</CommandEmpty>
          <CommandGroup>
            {pages.map((p) => {
              const Icon = p.icon;
              return (
                <CommandItem key={p.href} onSelect={() => go(p.href)}>
                  <Icon className="size-4" /> {t(p.key)}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {visibleResults.length > 0 && (
            <CommandGroup heading={t("nav.listings")}>
              {visibleResults.map((l) => (
                <CommandItem
                  key={l.id}
                  onSelect={() => go(`/listings/${l.id}`)}
                >
                  <Building2 className="size-4" />
                  <span className="truncate">{l.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {districtLabel(l.district)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
