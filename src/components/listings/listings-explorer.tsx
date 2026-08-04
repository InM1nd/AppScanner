"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ListingStatus } from "@prisma/client";
import type { ListingCardVM } from "@/server/view-models";
import { formatEur, districtLabel, formatRelativeTime } from "@/lib/format";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { updateListingStatusAction } from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  SearchX,
  X,
} from "lucide-react";

type SortKey = "score" | "newest" | "cost" | "commute" | "size" | "upfront";

const STATUS_OPTIONS: (ListingStatus | "ALL")[] = [
  "ALL",
  "NEW",
  "REVIEWING",
  "CONTACTED",
  "VIEWING",
  "SHORTLISTED",
  "REJECTED",
  "ARCHIVED",
];
const CONTRACT_TYPE_OPTIONS = [
  "ALL",
  "UNLIMITED",
  "FIXED_TERM",
  "TEMPORARY",
  "UNKNOWN",
] as const;

const SORT_LABELS: Record<SortKey, (t: (path: string) => string) => string> = {
  score: (t) => t("listings.sortScore"),
  newest: (t) => t("listings.sortNewest"),
  cost: (t) => t("listings.sortCost"),
  commute: (t) => t("listings.sortCommute"),
  size: (t) => t("listings.sortSize"),
  upfront: (t) => t("listings.sortUpfront"),
};

export function ListingsExplorer({
  listings,
  providers,
}: {
  listings: ListingCardVM[];
  providers: { id: string; name: string }[];
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = (key: string, fallback: string) =>
    searchParams.get(key) ?? fallback;
  const [view, setView] = useState<"table" | "cards">(() =>
    initial("view", "table") === "cards" ? "cards" : "table",
  );
  const [district, setDistrict] = useState(() => initial("district", "ALL"));
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(
    () => initial("status", "ALL") as (typeof STATUS_OPTIONS)[number],
  );
  const [providerId, setProviderId] = useState(() =>
    initial("provider", "ALL"),
  );
  const [maxPrice, setMaxPrice] = useState(() => initial("maxPrice", ""));
  const [minRooms, setMinRooms] = useState(() => initial("minRooms", ""));
  const [maxCommute, setMaxCommute] = useState(() =>
    initial("maxCommute", "ANY"),
  );
  const [parking, setParking] = useState(() => initial("parking", "ANY"));
  const [balcony, setBalcony] = useState(() => initial("balcony", "ANY"));
  const [elevator, setElevator] = useState(() => initial("elevator", "ANY"));
  const [contractType, setContractType] = useState<
    (typeof CONTRACT_TYPE_OPTIONS)[number]
  >(() => initial("contract", "ALL") as (typeof CONTRACT_TYPE_OPTIONS)[number]);
  const [moveInBy, setMoveInBy] = useState(() => initial("moveInBy", ""));
  const [sortKey, setSortKey] = useState<SortKey>(
    () => initial("sort", "score") as SortKey,
  );
  const [pageSize, setPageSize] = useState(
    () => Number(initial("size", "25")) || 25,
  );
  const [page, setPage] = useState(() =>
    Math.max(1, Number(initial("page", "1")) || 1),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (district !== "ALL" && String(l.district) !== district) return false;
      if (status !== "ALL" && l.status !== status) return false;
      if (providerId !== "ALL" && l.providerId !== providerId) return false;
      if (maxPrice && (l.monthlyLikelyTotal ?? Infinity) > Number(maxPrice))
        return false;
      if (minRooms && (l.rooms ?? 0) < Number(minRooms)) return false;
      if (parking === "YES" && l.parkingAvailability === "NONE") return false;
      if (balcony === "YES" && l.balcony !== "YES") return false;
      if (elevator === "YES" && l.elevator !== "YES") return false;
      if (contractType !== "ALL" && l.contractType !== contractType)
        return false;
      if (moveInBy) {
        if (
          !l.availabilityDate ||
          new Date(l.availabilityDate) > new Date(moveInBy)
        )
          return false;
      }
      if (maxCommute !== "ANY") {
        const commute = l.commuteEstimates[0];
        if (
          !commute ||
          (commute.durationMinutes ?? Infinity) > Number(maxCommute)
        )
          return false;
      }
      return true;
    });
  }, [
    listings,
    district,
    status,
    providerId,
    maxPrice,
    minRooms,
    parking,
    balcony,
    elevator,
    contractType,
    moveInBy,
    maxCommute,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "score":
        return arr.sort(
          (a, b) =>
            (b.scoreBreakdown?.totalScore ?? -1) -
            (a.scoreBreakdown?.totalScore ?? -1),
        );
      case "newest":
        return arr.sort(
          (a, b) =>
            new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
        );
      case "cost":
        return arr.sort(
          (a, b) =>
            (a.monthlyLikelyTotal ?? Infinity) -
            (b.monthlyLikelyTotal ?? Infinity),
        );
      case "commute":
        return arr.sort(
          (a, b) =>
            (a.commuteEstimates[0]?.durationMinutes ?? Infinity) -
            (b.commuteEstimates[0]?.durationMinutes ?? Infinity),
        );
      case "size":
        return arr.sort(
          (a, b) => (b.squareMeters ?? 0) - (a.squareMeters ?? 0),
        );
      case "upfront":
        return arr.sort(
          (a, b) =>
            (a.upfrontCostEstimate ?? Infinity) -
            (b.upfrontCostEstimate ?? Infinity),
        );
    }
  }, [filtered, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const activeFocusIndex = Math.min(focusIndex, Math.max(paged.length - 1, 0));
  const filterKey = [
    district,
    status,
    providerId,
    maxPrice,
    minRooms,
    maxCommute,
    parking,
    balcony,
    elevator,
    contractType,
    moveInBy,
    sortKey,
    pageSize,
  ].join("|");
  const previousFilterKey = useRef(filterKey);

  useEffect(() => {
    if (previousFilterKey.current !== filterKey) {
      previousFilterKey.current = filterKey;
      setPage(1);
    }
  }, [filterKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    const values = {
      district,
      status,
      provider: providerId,
      maxPrice,
      minRooms,
      maxCommute,
      parking,
      balcony,
      elevator,
      contract: contractType,
      moveInBy,
      sort: sortKey,
      view,
      size: String(pageSize),
      page: String(currentPage),
    };
    for (const [key, value] of Object.entries(values)) {
      if (value && !["ALL", "ANY", "table", "score", "25", "1"].includes(value))
        params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [
    district,
    status,
    providerId,
    maxPrice,
    minRooms,
    maxCommute,
    parking,
    balcony,
    elevator,
    contractType,
    moveInBy,
    sortKey,
    view,
    pageSize,
    currentPage,
    pathname,
    router,
  ]);

  const applyStatus = useCallback(
    async (ids: string[], newStatus: ListingStatus) => {
      if (bulkPending || ids.length === 0) return;
      setBulkError(null);
      setBulkPending(true);
      try {
        await Promise.all(
          ids.map((id) => updateListingStatusAction(id, newStatus)),
        );
        toast.success(`${ids.length} × ${t(`status.${newStatus}`)}`);
        setSelected(new Set());
        router.refresh();
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Could not update the selected listings.";
        setBulkError(message);
        toast.error(message);
      } finally {
        setBulkPending(false);
      }
    },
    [bulkPending, router, t],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        e.defaultPrevented ||
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        !(target instanceof HTMLElement) ||
        target.isContentEditable ||
        target.closest(
          'a, button, input, textarea, select, [role="button"], [role="checkbox"], [role="combobox"], [role="menuitem"], [role="option"], [role="switch"], [contenteditable="true"]',
        )
      )
        return;
      const current = paged[activeFocusIndex];
      if (e.key === "j")
        setFocusIndex(Math.min(activeFocusIndex + 1, paged.length - 1));
      else if (e.key === "k") setFocusIndex(Math.max(activeFocusIndex - 1, 0));
      else if (e.key === "x" && current) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(current.id)) next.delete(current.id);
          else next.add(current.id);
          return next;
        });
      } else if (current && ["s", "r", "a"].includes(e.key)) {
        const map = { s: "SHORTLISTED", r: "REJECTED", a: "ARCHIVED" } as const;
        void applyStatus([current.id], map[e.key as "s" | "r" | "a"]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paged, activeFocusIndex, applyStatus]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (district !== "ALL")
    activeFilters.push({
      key: "district",
      label: districtLabel(Number(district)),
      clear: () => setDistrict("ALL"),
    });
  if (status !== "ALL")
    activeFilters.push({
      key: "status",
      label: t(`status.${status}`),
      clear: () => setStatus("ALL"),
    });
  if (providerId !== "ALL")
    activeFilters.push({
      key: "provider",
      label: providers.find((p) => p.id === providerId)?.name ?? providerId,
      clear: () => setProviderId("ALL"),
    });
  if (contractType !== "ALL")
    activeFilters.push({
      key: "contract",
      label: contractType,
      clear: () => setContractType("ALL"),
    });
  if (maxPrice)
    activeFilters.push({
      key: "maxPrice",
      label: `≤ €${maxPrice}`,
      clear: () => setMaxPrice(""),
    });
  if (minRooms)
    activeFilters.push({
      key: "minRooms",
      label: `≥ ${minRooms} ${t("listings.colRooms").toLowerCase()}`,
      clear: () => setMinRooms(""),
    });
  if (maxCommute !== "ANY")
    activeFilters.push({
      key: "commute",
      label: `≤ ${maxCommute} ${t("common.unitMin")}`,
      clear: () => setMaxCommute("ANY"),
    });
  if (parking === "YES")
    activeFilters.push({
      key: "parking",
      label: t("listings.filterHasParking"),
      clear: () => setParking("ANY"),
    });
  if (balcony === "YES")
    activeFilters.push({
      key: "balcony",
      label: t("listings.filterHasBalcony"),
      clear: () => setBalcony("ANY"),
    });
  if (elevator === "YES")
    activeFilters.push({
      key: "elevator",
      label: t("listings.filterHasElevator"),
      clear: () => setElevator("ANY"),
    });
  if (moveInBy)
    activeFilters.push({
      key: "moveInBy",
      label: `${t("listings.filterMoveInBy")} ${moveInBy}`,
      clear: () => setMoveInBy(""),
    });

  const rangeFrom = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, sorted.length);

  return (
    <div ref={containerRef} className="space-y-4">
      <Card size="sm" className="elevate">
        <CardContent className="space-y-3 px-4">
          <FilterGroup label={t("listings.filterGroupBasics")}>
            <Select
              value={district}
              onValueChange={(v) => v !== null && setDistrict(v)}
            >
              <SelectTrigger
                className="w-36 h-9"
                aria-label={t("listings.filterDistrict")}
              >
                <SelectValue placeholder={t("listings.filterDistrict")}>
                  {(v: string) =>
                    v === "ALL"
                      ? t("listings.filterAllDistricts")
                      : districtLabel(Number(v))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t("listings.filterAllDistricts")}
                </SelectItem>
                {[14, 15, 16, 6, 7, 10, 11, 12].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {districtLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(v) => setStatus(v as typeof status)}
            >
              <SelectTrigger
                className="w-36 h-9"
                aria-label={t("listings.filterStatus")}
              >
                <SelectValue placeholder={t("listings.filterStatus")}>
                  {(v: string) =>
                    v === "ALL"
                      ? t("listings.filterAllStatuses")
                      : t(`status.${v}`)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL"
                      ? t("listings.filterAllStatuses")
                      : t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={providerId}
              onValueChange={(v) => v !== null && setProviderId(v)}
            >
              <SelectTrigger
                className="w-40 h-9"
                aria-label={t("listings.filterSource")}
              >
                <SelectValue placeholder={t("listings.filterSource")}>
                  {(v: string) =>
                    v === "ALL"
                      ? t("listings.filterAllSources")
                      : (providers.find((p) => p.id === v)?.name ?? v)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t("listings.filterAllSources")}
                </SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={contractType}
              onValueChange={(v) =>
                v !== null && setContractType(v as typeof contractType)
              }
            >
              <SelectTrigger
                className="w-40 h-9"
                aria-label={t("listings.filterContractType")}
              >
                <SelectValue placeholder={t("listings.filterContractType")}>
                  {(v: string) =>
                    v === "ALL" ? t("listings.filterAllContractTypes") : v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPE_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "ALL" ? t("listings.filterAllContractTypes") : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>

          <div className="h-px bg-border" />

          <FilterGroup label={t("listings.filterGroupConstraints")}>
            <Input
              placeholder={t("listings.filterMaxPrice")}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-28 h-9"
              type="number"
              aria-label={t("listings.filterMaxPrice")}
            />
            <Input
              placeholder={t("listings.filterMinRooms")}
              value={minRooms}
              onChange={(e) => setMinRooms(e.target.value)}
              className="w-28 h-9"
              type="number"
              step="0.5"
              aria-label={t("listings.filterMinRooms")}
            />

            <Select
              value={maxCommute}
              onValueChange={(v) => v !== null && setMaxCommute(v)}
            >
              <SelectTrigger
                className="w-40 h-9"
                aria-label={t("listings.filterCommute")}
              >
                <SelectValue placeholder={t("listings.filterCommute")}>
                  {(v: string) =>
                    v === "ANY"
                      ? t("listings.filterAnyCommute")
                      : `≤ ${v} ${t("common.unitMin")}`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">
                  {t("listings.filterAnyCommute")}
                </SelectItem>
                <SelectItem value="20">≤ 20 {t("common.unitMin")}</SelectItem>
                <SelectItem value="30">≤ 30 {t("common.unitMin")}</SelectItem>
                <SelectItem value="35">≤ 35 {t("common.unitMin")}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={parking}
              onValueChange={(v) => v !== null && setParking(v)}
            >
              <SelectTrigger
                className="w-36 h-9"
                aria-label={t("listings.filterParking")}
              >
                <SelectValue placeholder={t("listings.filterParking")}>
                  {(v: string) =>
                    v === "ANY"
                      ? t("listings.filterAnyParking")
                      : t("listings.filterHasParking")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">
                  {t("listings.filterAnyParking")}
                </SelectItem>
                <SelectItem value="YES">
                  {t("listings.filterHasParking")}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={balcony}
              onValueChange={(v) => v !== null && setBalcony(v)}
            >
              <SelectTrigger
                className="w-36 h-9"
                aria-label={t("listings.filterBalcony")}
              >
                <SelectValue placeholder={t("listings.filterBalcony")}>
                  {(v: string) =>
                    v === "ANY"
                      ? t("listings.filterAnyBalcony")
                      : t("listings.filterHasBalcony")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">
                  {t("listings.filterAnyBalcony")}
                </SelectItem>
                <SelectItem value="YES">
                  {t("listings.filterHasBalcony")}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={elevator}
              onValueChange={(v) => v !== null && setElevator(v)}
            >
              <SelectTrigger
                className="w-36 h-9"
                aria-label={t("listings.filterElevator")}
              >
                <SelectValue placeholder={t("listings.filterElevator")}>
                  {(v: string) =>
                    v === "ANY"
                      ? t("listings.filterAnyElevator")
                      : t("listings.filterHasElevator")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">
                  {t("listings.filterAnyElevator")}
                </SelectItem>
                <SelectItem value="YES">
                  {t("listings.filterHasElevator")}
                </SelectItem>
              </SelectContent>
            </Select>

            <label className="flex h-9 items-center gap-2 rounded-md border border-input px-2.5 text-xs text-muted-foreground">
              {t("listings.filterMoveInBy")}
              <input
                value={moveInBy}
                onChange={(e) => setMoveInBy(e.target.value)}
                type="date"
                aria-label={t("listings.filterMoveInBy")}
                className="bg-transparent text-xs text-foreground outline-none"
              />
            </label>
          </FilterGroup>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t("listings.filterActive")}
              </span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.clear}
                  aria-label={`${t("listings.filterRemove")}: ${f.label}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {f.label}
                  <X className="size-3" />
                </button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  activeFilters.forEach((f) => f.clear());
                  setPage(1);
                }}
              >
                {t("listings.filterReset")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("listings.toolbarShowing")}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {rangeFrom}–{rangeTo}
          </span>{" "}
          {t("listings.toolbarOf")}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {sorted.length}
          </span>
          <span className="hidden lg:inline"> · {t("listings.shortcuts")}</span>
        </p>

        <div className="flex items-center gap-2">
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
          >
            <SelectTrigger
              className="w-44 h-9"
              aria-label={t("listings.sortBy")}
            >
              <SelectValue placeholder={t("listings.sortBy")}>
                {(v: SortKey) => SORT_LABELS[v]?.(t) ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">{t("listings.sortScore")}</SelectItem>
              <SelectItem value="newest">{t("listings.sortNewest")}</SelectItem>
              <SelectItem value="cost">{t("listings.sortCost")}</SelectItem>
              <SelectItem value="commute">
                {t("listings.sortCommute")}
              </SelectItem>
              <SelectItem value="size">{t("listings.sortSize")}</SelectItem>
              <SelectItem value="upfront">
                {t("listings.sortUpfront")}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => v !== null && setPageSize(Number(v))}
          >
            <SelectTrigger
              className="w-20 h-9"
              aria-label={t("listings.rowsPerPage")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="table" aria-label={t("listings.viewTable")}>
                <List className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="cards" aria-label={t("listings.viewCards")}>
                <LayoutGrid className="size-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {bulkError && (
        <p role="alert" className="text-sm text-destructive">
          {bulkError}
        </p>
      )}

      {sorted.length > 0 && (
        <div className="space-y-2 md:hidden">
          {paged.map((l) => (
            <Link
              key={l.id}
              href={`/listings/${l.id}`}
              className="block rounded-lg bg-card p-3 ring-1 ring-foreground/10 active:bg-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{l.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {districtLabel(l.district)} · {l.rooms ?? "?"}{" "}
                    {t("listings.colRooms").toLowerCase()} ·{" "}
                    {l.squareMeters ?? "?"} m²
                  </div>
                </div>
                <ScoreBadge
                  score={l.scoreBreakdown?.totalScore ?? 0}
                  isZeroed={l.scoreBreakdown?.isZeroed}
                  size="sm"
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                <span>
                  <b className="block text-sm tabular-nums text-foreground">
                    {formatEur(l.monthlyLikelyTotal)}
                  </b>
                  {t("listings.cardAllIn")}
                </span>
                <span>
                  <b className="block text-sm tabular-nums text-foreground">
                    {l.scoreBreakdown?.dataCompleteness ?? 0}%
                  </b>
                  {t("listings.cardData")}
                </span>
                <span>
                  <b className="block text-sm tabular-nums text-foreground">
                    {l.commuteEstimates[0]?.durationMinutes ?? "—"}
                  </b>
                  {t("listings.cardCommute")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <SearchX className="size-7 text-muted-foreground/40" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("listings.emptyState")}{" "}
            <Link href="/import" className="text-primary hover:underline">
              {t("listings.emptyStateCta")}
            </Link>{" "}
            {t("listings.emptyStateSuffix")}
          </p>
        </div>
      ) : view === "table" ? (
        <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="w-9 px-2 py-2.5">
                  <span className="sr-only">{t("listings.selectRow")}</span>
                </th>
                <th className="p-2.5 text-left font-medium">
                  {t("listings.colListing")}
                </th>
                <th className="p-2.5 text-left font-medium">
                  {t("listings.colDistrict")}
                </th>
                <th className="p-2.5 text-right font-medium">
                  {t("listings.colPrice")}
                </th>
                <th className="p-2.5 text-right font-medium">
                  {t("listings.colRooms")}
                </th>
                <th className="p-2.5 text-right font-medium">
                  {t("listings.colSize")}
                </th>
                <th className="p-2.5 text-right font-medium">
                  {t("listings.colCommute")}
                </th>
                <th className="p-2.5 text-left font-medium">
                  {t("listings.colStatus")}
                </th>
                <th className="p-2.5 text-right font-medium">
                  {t("listings.colScore")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((l, i) => (
                <tr
                  key={l.id}
                  className={cn(
                    "h-14 border-t border-border/70 transition-colors hover:bg-accent/40",
                    i === activeFocusIndex &&
                      "bg-accent/30 ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <td className="px-2">
                    <Checkbox
                      aria-label={`${t("listings.selectRow")}: ${l.title}`}
                      checked={selected.has(l.id)}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="max-w-md p-2.5">
                    <Link
                      href={`/listings/${l.id}`}
                      title={l.title}
                      className="line-clamp-1 font-medium hover:text-primary hover:underline"
                    >
                      {l.title}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {l.provider.displayName} ·{" "}
                      {formatRelativeTime(l.importedAt)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-2.5 text-muted-foreground">
                    {districtLabel(l.district)}
                  </td>
                  <td className="p-2.5 text-right font-medium tabular-nums">
                    {formatEur(l.monthlyLikelyTotal)}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {l.rooms ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {l.squareMeters ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {l.commuteEstimates[0]?.durationMinutes ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="p-2.5 text-right">
                    <ScoreBadge
                      score={l.scoreBreakdown?.totalScore ?? 0}
                      isZeroed={l.scoreBreakdown?.isZeroed}
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paged.map((l) => (
            <Link key={l.id} href={`/listings/${l.id}`} className="group">
              <Card className="elevate h-full py-4 transition-colors group-hover:ring-primary/40">
                <CardContent className="flex h-full flex-col gap-2 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      title={l.title}
                      className="line-clamp-2 text-sm font-medium leading-tight"
                    >
                      {l.title}
                    </div>
                    <ScoreBadge
                      score={l.scoreBreakdown?.totalScore ?? 0}
                      isZeroed={l.scoreBreakdown?.isZeroed}
                      size="sm"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {districtLabel(l.district)} · {l.rooms ?? "?"}{" "}
                    {t("listings.colRooms").toLowerCase()} ·{" "}
                    {l.squareMeters ?? "?"} m²
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatEur(l.monthlyLikelyTotal)}/mo
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {sorted.length > 0 && pageCount > 1 && (
        <nav
          aria-label="Listings pagination"
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="size-4" />
            {t("listings.paginationPrev")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {currentPage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            {t("listings.paginationNext")}
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-full bg-popover px-3 py-2 text-sm elevate ring-1 ring-foreground/15">
          <span className="px-1 font-medium tabular-nums">
            {selected.size} {t("listings.bulkSelected")}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => applyStatus([...selected], "SHORTLISTED")}
            disabled={bulkPending}
          >
            {t("listings.bulkShortlist")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => applyStatus([...selected], "REJECTED")}
            disabled={bulkPending}
          >
            {t("listings.bulkReject")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => applyStatus([...selected], "ARCHIVED")}
            disabled={bulkPending}
          >
            {t("listings.bulkArchive")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => setSelected(new Set())}
            disabled={bulkPending}
          >
            {t("listings.bulkClear")}
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}
