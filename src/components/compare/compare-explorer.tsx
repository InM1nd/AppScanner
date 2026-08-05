"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingCardVM } from "@/server/view-models";
import { formatEur, districtLabel } from "@/lib/format";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import { bestIndexes } from "@/lib/compare";
import { Columns3, Plus, X } from "lucide-react";

const SLOTS = [0, 1, 2, 3];

export function CompareExplorer({ listings }: { listings: ListingCardVM[] }) {
  const { t } = useTranslations();
  const [ids, setIds] = useState<string[]>(["", "", "", ""]);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const selected = ids
    .map((id) => listings.find((l) => l.id === id))
    .filter(Boolean) as ListingCardVM[];

  // With fewer than two listings there is nothing to differ, so the filter
  // would hide every row and leave an unexplained empty table.
  const canDiff = selected.length >= 2;
  const diffing = onlyDifferences && canDiff;
  const show = (values: unknown[]) =>
    !diffing || new Set(values.map((value) => JSON.stringify(value))).size > 1;

  function setSlot(slot: number, value: string) {
    setIds((prev) => prev.map((p, i) => (i === slot ? value : p)));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SLOTS.map((slot) => {
          const listing = listings.find((l) => l.id === ids[slot]);
          return (
            <div
              key={slot}
              className={cn(
                "rounded-xl p-3 transition-colors",
                listing
                  ? "bg-card ring-1 ring-foreground/10 elevate"
                  : "border border-dashed border-border",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("compare.slot")} {slot + 1}
                </span>
                {listing && (
                  <button
                    type="button"
                    onClick={() => setSlot(slot, "")}
                    aria-label={t("compare.clearSlot")}
                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {listing ? (
                <div className="space-y-2">
                  <Link
                    href={`/listings/${listing.id}`}
                    title={listing.title}
                    className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary hover:underline"
                  >
                    {listing.title}
                  </Link>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatEur(listing.monthlyLikelyTotal)}
                    </span>
                    <ScoreBadge
                      score={listing.scoreBreakdown?.totalScore ?? 0}
                      isZeroed={listing.scoreBreakdown?.isZeroed}
                      size="sm"
                    />
                  </div>
                </div>
              ) : (
                <Select
                  value=""
                  onValueChange={(v) => v !== null && setSlot(slot, v)}
                >
                  <SelectTrigger
                    className="h-9 w-full"
                    aria-label={`${t("compare.slot")} ${slot + 1}`}
                  >
                    <SelectValue placeholder={t("compare.addListing")}>
                      {() => (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Plus className="size-3.5" />
                          {t("compare.addListing")}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {listings.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={onlyDifferences}
            disabled={!canDiff}
            onCheckedChange={(checked) => setOnlyDifferences(Boolean(checked))}
          />
          {t("compare.showDifferences")}
        </label>
        {!canDiff && (
          <span className="text-xs text-muted-foreground">
            {t("compare.showDifferencesHint")}
          </span>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <Columns3 className="size-7 text-muted-foreground/40" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("compare.emptyState")}
          </p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/listings" />}
          >
            {t("nav.listings")}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 w-44 bg-muted/90 p-3 text-left text-xs font-medium text-muted-foreground"
                >
                  {t("compare.rowListing")}
                </th>
                {selected.map((l) => (
                  <th
                    key={l.id}
                    scope="col"
                    className="p-3 text-left align-top"
                  >
                    <Link
                      href={`/listings/${l.id}`}
                      title={l.title}
                      className="line-clamp-2 font-medium hover:text-primary hover:underline"
                    >
                      {l.title}
                    </Link>
                    <div className="mt-1.5">
                      <ScoreBadge
                        score={l.scoreBreakdown?.totalScore ?? 0}
                        isZeroed={l.scoreBreakdown?.isZeroed}
                        size="sm"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {show(selected.map((l) => l.status)) && (
                <Row
                  label={t("compare.rowStatus")}
                  cells={selected.map((l) => (
                    <StatusBadge key={l.id} status={l.status} />
                  ))}
                />
              )}
              {show(selected.map((l) => l.scoreBreakdown?.totalScore)) && (
                <Row
                  label={t("compare.rowScore")}
                  best={bestIndexes(
                    selected.map((l) =>
                      l.scoreBreakdown?.isZeroed
                        ? null
                        : l.scoreBreakdown?.totalScore,
                    ),
                    "max",
                  )}
                  bestLabel={t("compare.best")}
                  cells={selected.map((l) => (
                    <ScoreBadge
                      key={l.id}
                      score={l.scoreBreakdown?.totalScore ?? 0}
                      isZeroed={l.scoreBreakdown?.isZeroed}
                    />
                  ))}
                />
              )}
              {show(
                selected.map((l) => l.scoreBreakdown?.dataCompleteness),
              ) && (
                <Row
                  label={t("compare.rowCompleteness")}
                  best={bestIndexes(
                    selected.map((l) => l.scoreBreakdown?.dataCompleteness),
                    "max",
                  )}
                  bestLabel={t("compare.best")}
                  cells={selected.map(
                    (l) => `${l.scoreBreakdown?.dataCompleteness ?? 0}%`,
                  )}
                />
              )}
              {show(selected.map((l) => l.district)) && (
                <Row
                  label={t("compare.rowDistrict")}
                  cells={selected.map((l) => districtLabel(l.district))}
                />
              )}
              {show(selected.map((l) => l.monthlyLikelyTotal)) && (
                <Row
                  label={t("compare.rowMonthlyTotal")}
                  best={bestIndexes(
                    selected.map((l) => l.monthlyLikelyTotal),
                    "min",
                  )}
                  bestLabel={t("compare.best")}
                  cells={selected.map((l) => (
                    <b key={l.id} className="tabular-nums">
                      {formatEur(l.monthlyLikelyTotal)}
                    </b>
                  ))}
                />
              )}
              {show(
                selected.map((l) => [
                  l.upfrontCostEstimate,
                  l.hasUnknownUpfrontCost,
                  l.unknownUpfrontFields,
                ]),
              ) && (
                <Row
                  label={t("compare.rowUpfront")}
                  cells={selected.map((l) => (
                    <UpfrontValue key={l.id} listing={l} />
                  ))}
                />
              )}
              {show(
                selected.map((l) => {
                  const commute = l.commuteEstimates[0];
                  return [commute?.durationMinutes, commute?.provider];
                }),
              ) && (
                <Row
                  label={t("compare.rowCommute")}
                  best={bestIndexes(
                    selected.map((l) => l.commuteEstimates[0]?.durationMinutes),
                    "min",
                  )}
                  bestLabel={t("compare.best")}
                  cells={selected.map((l) => (
                    <CommuteValue
                      key={l.id}
                      estimate={l.commuteEstimates[0]}
                      unit={t("common.unitMin")}
                    />
                  ))}
                />
              )}
              {show(selected.map((l) => [l.rooms, l.hasSeparateBedroom])) && (
                <Row
                  label={t("compare.rowLayout")}
                  cells={selected.map((l) => (
                    <span key={l.id}>
                      <span className="tabular-nums">{l.rooms ?? "—"}</span>{" "}
                      {t("compare.layoutRooms")}
                      {l.hasSeparateBedroom === "YES" && (
                        <span className="block text-xs text-muted-foreground">
                          {t("compare.layoutSeparateBedroom")}
                        </span>
                      )}
                    </span>
                  ))}
                />
              )}
              {show(selected.map((l) => l.parkingAvailability)) && (
                <Row
                  label={t("compare.rowParking")}
                  cells={selected.map((l) => (
                    <span key={l.id}>
                      {t(`parking.${l.parkingAvailability}`)}
                    </span>
                  ))}
                />
              )}
              {show(selected.map((l) => l.costRedFlags)) && (
                <Row
                  label={t("compare.rowHiddenCost")}
                  cells={selected.map((l) => {
                    return l.costRedFlags.length === 0 ? (
                      <span key={l.id} className="text-xs text-success">
                        {t("compare.noFlags")}
                      </span>
                    ) : (
                      <div key={l.id} className="flex flex-wrap gap-1">
                        {l.costRedFlags.map((f) => (
                          <Badge
                            key={f}
                            variant="destructive"
                            className="text-[10px]"
                          >
                            {t(`redFlag.${f}`)}
                          </Badge>
                        ))}
                      </div>
                    );
                  })}
                />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  cells,
  best,
  bestLabel,
}: {
  label: string;
  cells: React.ReactNode[];
  best?: Set<number>;
  bestLabel?: string;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <th
        scope="row"
        className="sticky left-0 z-10 w-44 whitespace-nowrap bg-muted p-3 text-left text-xs font-medium text-muted-foreground"
      >
        {label}
      </th>
      {cells.map((c, i) => {
        const isBest = best?.has(i) ?? false;
        return (
          <td key={i} className="p-3 align-top">
            <span className="inline-flex items-baseline gap-1.5">
              {c}
              {isBest && (
                <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                  {bestLabel}
                </span>
              )}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

function UpfrontValue({ listing }: { listing: ListingCardVM }) {
  const { t } = useTranslations();
  if (!listing.hasUnknownUpfrontCost) {
    return (
      <span className="tabular-nums">
        {formatEur(listing.upfrontCostEstimate)}
      </span>
    );
  }
  const unknown = listing.unknownUpfrontFields
    .map((field) => field.replace(/([A-Z])/g, " $1").toLowerCase())
    .join(", ");
  return (
    <span className="block max-w-56 text-xs leading-5">
      {t("compare.upfrontAtLeast")}{" "}
      <strong className="tabular-nums">
        {formatEur(listing.upfrontCostEstimate)}
      </strong>
      <span className="block text-muted-foreground">
        {t("compare.upfrontPlusUnknown")} {unknown || t("compare.upfrontCosts")}
      </span>
    </span>
  );
}

function CommuteValue({
  estimate,
  unit,
}: {
  estimate: ListingCardVM["commuteEstimates"][number] | undefined;
  unit: string;
}) {
  if (!estimate || estimate.durationMinutes === null)
    return <span className="text-muted-foreground">—</span>;
  const approximate = estimate.provider.toLowerCase() === "mock";
  return (
    <span className="block whitespace-nowrap">
      <span className="font-medium tabular-nums">
        {estimate.durationMinutes} {unit}
      </span>
      <span className="block text-xs text-muted-foreground">
        {estimate.provider}
        {approximate ? " · approximate" : ""}
      </span>
    </span>
  );
}
