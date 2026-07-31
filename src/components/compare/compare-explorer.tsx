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
import { useTranslations } from "@/i18n/locale-context";
import { Checkbox } from "@/components/ui/checkbox";

const SLOTS = [0, 1, 2, 3];

export function CompareExplorer({ listings }: { listings: ListingCardVM[] }) {
  const { t } = useTranslations();
  const [ids, setIds] = useState<string[]>(["", "", "", ""]);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const selected = ids
    .map((id) => listings.find((l) => l.id === id))
    .filter(Boolean) as ListingCardVM[];
  const show = (values: unknown[]) =>
    !onlyDifferences ||
    new Set(values.map((value) => JSON.stringify(value))).size > 1;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SLOTS.map((slot) => (
          <Select
            key={slot}
            value={ids[slot]}
            onValueChange={(v) =>
              v !== null &&
              setIds((prev) => prev.map((p, i) => (i === slot ? v : p)))
            }
          >
            <SelectTrigger
              className="h-9"
              aria-label={`${t("compare.slot")} ${slot + 1}`}
            >
              <SelectValue
                placeholder={`${t("compare.slot")} ${slot + 1}: ${t("compare.chooseListing")}`}
              />
            </SelectTrigger>
            <SelectContent>
              {listings.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={onlyDifferences}
          onCheckedChange={(checked) => setOnlyDifferences(Boolean(checked))}
        />
        Show differences only
      </label>

      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("compare.emptyState")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <Row
                label={t("compare.rowListing")}
                cells={selected.map((l) => (
                  <Link
                    key={l.id}
                    href={`/listings/${l.id}`}
                    className="font-medium hover:underline"
                  >
                    {l.title}
                  </Link>
                ))}
              />
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
                  label="Data completeness"
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
                  cells={selected.map((l) => (
                    <b key={l.id}>{formatEur(l.monthlyLikelyTotal)}</b>
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
                  cells={selected.map(
                    (l) =>
                      `${l.rooms ?? "?"} · ${l.hasSeparateBedroom === "YES" ? "✓" : "—"}`,
                  )}
                />
              )}
              {show(selected.map((l) => l.parkingAvailability)) && (
                <Row
                  label={t("compare.rowParking")}
                  cells={selected.map((l) =>
                    l.parkingAvailability.replace(/_/g, " ").toLowerCase(),
                  )}
                />
              )}
              {show(selected.map((l) => l.costRedFlags)) && (
                <Row
                  label={t("compare.rowHiddenCost")}
                  cells={selected.map((l) => {
                    return l.costRedFlags.length === 0 ? (
                      <span
                        key={l.id}
                        className="text-emerald-600 dark:text-emerald-400 text-xs"
                      >
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
                            {f.replace(/_/g, " ").toLowerCase()}
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

function Row({ label, cells }: { label: string; cells: React.ReactNode[] }) {
  return (
    <tr className="border-b border-border last:border-0">
      <th
        scope="row"
        className="sticky left-0 z-10 w-40 whitespace-nowrap bg-muted p-3 text-left text-xs font-medium text-muted-foreground"
      >
        {label}
      </th>
      {cells.map((c, i) => (
        <td key={i} className="p-3 align-top">
          {c}
        </td>
      ))}
    </tr>
  );
}

function UpfrontValue({ listing }: { listing: ListingCardVM }) {
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
      At least{" "}
      <strong className="tabular-nums">
        {formatEur(listing.upfrontCostEstimate)}
      </strong>{" "}
      + unknown {unknown || "costs"}
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
  if (!estimate || estimate.durationMinutes === null) return <span>—</span>;
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
