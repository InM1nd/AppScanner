import type { ListingCardVM } from "@/server/view-models";
import { formatEur } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function DecisionStrip({ listing }: { listing: ListingCardVM }) {
  const commute = listing.commuteEstimates[0];
  const approximate = commute?.provider.toLowerCase() === "mock";
  const uncertaintyFlags = new Set([
    "HEATING_UNCLEAR",
    "ELECTRICITY_UNCLEAR",
    "NO_AVAILABILITY_DATE",
  ]);
  const blockers = listing.scoreBreakdown?.zeroReason
    ? [listing.scoreBreakdown.zeroReason]
    : [];
  if (["RESERVED", "GONE"].includes(listing.sourceAvailability)) {
    blockers.push(`Source: ${listing.sourceAvailability.toLowerCase()}`);
  }
  const gaps = [
    ...(listing.sourceAvailability === "UNKNOWN"
      ? ["Source availability unknown"]
      : []),
    ...listing.costRedFlags.filter((flag) => uncertaintyFlags.has(flag)),
  ];
  const risks = listing.costRedFlags.filter(
    (flag) => !uncertaintyFlags.has(flag),
  );

  return (
    <section
      aria-label="Decision summary"
      className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-5"
    >
      <Metric
        label="All-in"
        value={`${formatEur(listing.monthlyLikelyTotal)}/mo`}
      />
      <Metric
        label="Score"
        value={`${listing.scoreBreakdown?.totalScore ?? 0}/100`}
      />
      <Metric
        label="Data"
        value={`${listing.scoreBreakdown?.dataCompleteness ?? 0}%`}
      />
      <Metric
        label="Commute"
        value={
          commute?.durationMinutes
            ? `${commute.durationMinutes} min${approximate ? " · approx." : ""}`
            : "Not calculated"
        }
      />
      <div className="min-w-0 bg-background px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Blockers / risks / gaps
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {blockers.length + risks.length + gaps.length === 0 ? (
            <span className="text-sm font-medium text-emerald-700">
              No confirmed blockers
            </span>
          ) : (
            <>
              {blockers.slice(0, 1).map((blocker) => (
                <Badge
                  key={`blocker-${blocker}`}
                  variant="destructive"
                  className="max-w-full truncate text-[10px]"
                  title={`Confirmed blocker: ${formatIssue(blocker)}`}
                >
                  Blocker: {formatIssue(blocker)}
                </Badge>
              ))}
              {risks.slice(0, 1).map((risk) => (
                <Badge
                  key={`risk-${risk}`}
                  variant="secondary"
                  className="max-w-full truncate text-[10px]"
                  title={`Confirmed risk: ${formatIssue(risk)}`}
                >
                  Risk: {formatIssue(risk)}
                </Badge>
              ))}
              {gaps.slice(0, 1).map((gap) => (
                <Badge
                  key={`gap-${gap}`}
                  variant="outline"
                  className="max-w-full truncate text-[10px]"
                  title={`Data gap: ${formatIssue(gap)}`}
                >
                  Gap: {formatIssue(gap)}
                </Badge>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function formatIssue(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
