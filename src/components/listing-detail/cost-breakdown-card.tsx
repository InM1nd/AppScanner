import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEur } from "@/lib/format";
import type { CostRedFlag } from "@/lib/cost";
import type { ListingCardVM } from "@/server/view-models";

const RED_FLAG_LABELS: Record<CostRedFlag, string> = {
  OVER_ABSOLUTE_MAX: "Exceeds absolute monthly max",
  HEATING_UNCLEAR: "Heating cost unclear",
  ELECTRICITY_UNCLEAR: "Electricity cost unclear",
  PARKING_SEPARATE_COST: "Parking billed separately",
  COMMISSION_OR_CONTRACT_FEE: "Commission or contract fee charged",
  HIGH_DEPOSIT: "Deposit exceeds 3 months' rent",
  NO_AVAILABILITY_DATE: "No availability date",
};

const MONEY_LABELS: Record<string, string> = {
  advertisedMonthlyTotal: "Advertised monthly total",
  baseRent: "Base rent",
  operatingCosts: "Operating costs (BK)",
  heatingCost: "Heating",
  hotWaterCost: "Hot water",
  parkingMonthlyCost: "Parking",
};

export function CostBreakdownCard({
  listing,
  title = "Financial breakdown",
  knownMonthlyLabel = "Known monthly",
  likelyMonthlyLabel = "Likely monthly",
  upfrontCostLabel = "Upfront cost",
}: {
  listing: ListingCardVM;
  title?: string;
  knownMonthlyLabel?: string;
  likelyMonthlyLabel?: string;
  upfrontCostLabel?: string;
}) {
  const unknownUpfront = listing.unknownUpfrontFields.map((field) =>
    field.replace(/([A-Z])/g, " $1").toLowerCase(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {knownMonthlyLabel}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatEur(listing.monthlyKnownCost)}
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {likelyMonthlyLabel}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatEur(listing.monthlyLikelyTotal)}
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {upfrontCostLabel}
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {listing.hasUnknownUpfrontCost
                ? `At least ${formatEur(listing.upfrontCostEstimate)} + unknown ${unknownUpfront.join(", ")}`
                : formatEur(listing.upfrontCostEstimate)}
            </div>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          {Object.entries(MONEY_LABELS).map(([field, label]) => {
            const fact = (listing as Record<string, unknown>)[
              `${field}Amount`
            ] as number | null;
            const confidence = (listing as Record<string, unknown>)[
              `${field}Confidence`
            ] as string;
            return (
              <div
                key={field}
                className="flex items-center justify-between border-b border-border/50 py-1 last:border-0"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="flex items-center gap-2">
                  {confidence !== "EXACT" && (
                    <Badge variant="outline" className="text-[10px]">
                      {confidence === "UNKNOWN" ? "unknown" : "estimate"}
                    </Badge>
                  )}
                  <span className="tabular-nums font-medium">
                    {formatEur(fact)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {listing.unknownRecurringFields.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Unknown costs still to confirm:{" "}
            {listing.unknownRecurringFields
              .map((f) => MONEY_LABELS[f] ?? f)
              .join(", ")}
            .
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
          <span>Electricity estimate</span>
          <span className="text-right tabular-nums">
            {formatEur(listing.electricityEstimateAmount)}
          </span>
          <span>Internet estimate</span>
          <span className="text-right tabular-nums">
            {formatEur(listing.internetEstimateAmount)}
          </span>
          <span>Deposit</span>
          <span className="text-right tabular-nums">
            {formatEur(listing.depositAmount)}
          </span>
          <span>Commission</span>
          <span className="text-right tabular-nums">
            {formatEur(listing.commissionAmount)}
          </span>
          <span>Contract fee</span>
          <span className="text-right tabular-nums">
            {formatEur(listing.contractFeeAmount)}
          </span>
          <span>Known upfront minimum</span>
          <span className="text-right tabular-nums">
            {formatEur(listing.upfrontKnownTotal)}
          </span>
        </div>

        {listing.costRedFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {listing.costRedFlags.map((f) => (
              <Badge
                key={f}
                variant="destructive"
                className="text-[11px] font-normal"
              >
                {RED_FLAG_LABELS[f as CostRedFlag] ?? f}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
