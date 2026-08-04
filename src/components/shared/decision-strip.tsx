"use client";

import type { ListingCardVM } from "@/server/view-models";
import { formatEur } from "@/lib/format";
import { useTranslations } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

const UNCERTAINTY_FLAGS = new Set([
  "HEATING_UNCLEAR",
  "ELECTRICITY_UNCLEAR",
  "NO_AVAILABILITY_DATE",
]);

export function DecisionStrip({ listing }: { listing: ListingCardVM }) {
  const { t } = useTranslations();
  const commute = listing.commuteEstimates[0];
  const approximate = commute?.provider.toLowerCase() === "mock";

  const blockers = listing.scoreBreakdown?.zeroReason
    ? [listing.scoreBreakdown.zeroReason]
    : [];
  if (listing.sourceAvailability === "RESERVED")
    blockers.push(t("decision.sourceReserved"));
  if (listing.sourceAvailability === "GONE")
    blockers.push(t("decision.sourceGone"));

  const gaps = [
    ...(listing.sourceAvailability === "UNKNOWN"
      ? [t("decision.sourceUnknown")]
      : []),
    ...listing.costRedFlags
      .filter((flag) => UNCERTAINTY_FLAGS.has(flag))
      .map((flag) => t(`redFlag.${flag}`)),
  ];
  const risks = listing.costRedFlags
    .filter((flag) => !UNCERTAINTY_FLAGS.has(flag))
    .map((flag) => t(`redFlag.${flag}`));

  const clean = blockers.length + risks.length + gaps.length === 0;

  return (
    <section
      aria-label={t("listingDetail.overview")}
      className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-5 elevate"
    >
      <Metric
        label={t("decision.allIn")}
        value={`${formatEur(listing.monthlyLikelyTotal)}/mo`}
      />
      <Metric
        label={t("decision.score")}
        value={`${listing.scoreBreakdown?.totalScore ?? 0}/100`}
      />
      <Metric
        label={t("decision.data")}
        value={`${listing.scoreBreakdown?.dataCompleteness ?? 0}%`}
      />
      <Metric
        label={t("decision.commute")}
        value={
          commute?.durationMinutes
            ? `${commute.durationMinutes} ${t("common.unitMin")}${approximate ? ` · ${t("decision.approx")}` : ""}`
            : t("decision.notCalculated")
        }
        muted={!commute?.durationMinutes}
      />
      <div className="min-w-0 bg-card px-4 py-3">
        <Label>{t("decision.issues")}</Label>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {clean ? (
            <span className="text-sm font-medium text-success">
              {t("decision.noBlockers")}
            </span>
          ) : (
            <>
              {blockers.slice(0, 1).map((blocker) => (
                <Issue
                  key={`blocker-${blocker}`}
                  tone="danger"
                  prefix={t("decision.blocker")}
                  text={blocker}
                />
              ))}
              {risks.slice(0, 1).map((risk) => (
                <Issue
                  key={`risk-${risk}`}
                  tone="warning"
                  prefix={t("decision.risk")}
                  text={risk}
                />
              ))}
              {gaps.slice(0, 1).map((gap) => (
                <Issue
                  key={`gap-${gap}`}
                  tone="neutral"
                  prefix={t("decision.gap")}
                  text={gap}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <Label>{label}</Label>
      <div
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums tracking-tight",
          muted && "text-base font-normal text-muted-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

const ISSUE_TONE = {
  danger: "bg-danger/12 text-danger",
  warning: "bg-warning/14 text-warning",
  neutral: "bg-muted text-muted-foreground",
} as const;

function Issue({
  tone,
  prefix,
  text,
}: {
  tone: keyof typeof ISSUE_TONE;
  prefix: string;
  text: string;
}) {
  return (
    <span
      title={`${prefix}: ${text}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
        ISSUE_TONE[tone],
      )}
    >
      <span className="opacity-70">{prefix}:</span> {text}
    </span>
  );
}
