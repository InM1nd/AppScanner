import Link from "next/link";
import { db } from "@/lib/db";
import { listAllListings } from "@/server/queries";
import { formatEur } from "@/lib/format";
import { daysAgo } from "@/lib/time";
import { getTopMatches } from "@/lib/dashboard";
import { getDictionary } from "@/i18n/server";
import { ListingRow, EmptyRow } from "@/components/shared/listing-row";
import { TrendsCard } from "@/components/dashboard/trends-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProviderHealth } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Gauge,
  Radio,
  Star,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { dict } = await getDictionary();
  const d = dict.dashboard;
  const listings = await listAllListings();
  const providers = await db.provider.findMany({ orderBy: { name: "asc" } });
  const savedSearches = await db.savedSearch.findMany({
    include: { provider: true },
  });

  const threeDaysAgo = daysAgo(3);
  const newListings = listings
    .filter(
      (l) =>
        l.importedAt >= threeDaysAgo &&
        !["REJECTED", "ARCHIVED"].includes(l.status),
    )
    .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());

  const topMatches = getTopMatches(listings);

  const urgent = listings.filter((l) => {
    if (["REJECTED", "ARCHIVED"].includes(l.status)) return false;
    const highScore =
      (l.scoreBreakdown?.totalScore ?? 0) >= 70 &&
      (l.scoreBreakdown?.dataCompleteness ?? 0) >= 70 &&
      !l.scoreBreakdown?.isZeroed;
    const staleNew = l.status === "NEW" && l.importedAt < threeDaysAgo;
    const missingAvailability = l.costRedFlags.includes("NO_AVAILABILITY_DATE");
    return (
      (highScore && l.status === "NEW") ||
      staleNew ||
      (highScore && missingAvailability)
    );
  });

  const activeCount = listings.filter(
    (l) => !["REJECTED", "ARCHIVED"].includes(l.status),
  ).length;
  const shortlistedCount = listings.filter(
    (l) => l.status === "SHORTLISTED",
  ).length;
  const avgKnownCost = listings.length
    ? Math.round(
        listings.reduce(
          (sum, l) =>
            sum + (l.monthlyLikelyTotal ? Number(l.monthlyLikelyTotal) : 0),
          0,
        ) / listings.length,
      )
    : null;
  const avgScore = topMatches.length
    ? Math.round(
        topMatches.reduce(
          (sum, l) => sum + (l.scoreBreakdown?.totalScore ?? 0),
          0,
        ) / topMatches.length,
      )
    : null;

  const importsByDay: { date: string; count: number }[] = Array.from(
    { length: 14 },
    (_, i) => {
      const day = daysAgo(13 - i);
      const key = day.toISOString().slice(0, 10);
      const count = listings.filter(
        (l) => l.importedAt.toISOString().slice(0, 10) === key,
      ).length;
      return { date: key.slice(5), count };
    },
  );

  const districtCostMap = new Map<number, number[]>();
  for (const l of listings) {
    if (l.district === null || l.monthlyLikelyTotal === null) continue;
    const arr = districtCostMap.get(l.district) ?? [];
    arr.push(Number(l.monthlyLikelyTotal));
    districtCostMap.set(l.district, arr);
  }
  const districtCosts = [...districtCostMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([district, costs]) => ({
      district: String(district),
      avgCost: Math.round(costs.reduce((a, b) => a + b, 0) / costs.length),
    }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {d.subtitle}
          </p>
        </div>
        <Link
          href="/import"
          className="group inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 elevate transition-[transform,filter] hover:brightness-110 active:scale-[0.98]"
        >
          {d.importListing}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={d.statActive}
          value={String(activeCount)}
          hint={d.statActiveHint}
          icon={Building2}
        />
        <StatCard
          label={d.statShortlisted}
          value={String(shortlistedCount)}
          hint={d.statShortlistedHint}
          icon={Star}
        />
        <StatCard
          label={d.statAvgCost}
          value={avgKnownCost !== null ? formatEur(avgKnownCost) : "—"}
          hint={d.statAvgCostHint}
          icon={CircleDollarSign}
        />
        <StatCard
          label={d.statAvgScore}
          value={avgScore !== null ? `${avgScore}/100` : "—"}
          hint={d.statAvgScoreHint}
          icon={Gauge}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="elevate">
            <CardHeader>
              <CardTitle className="text-base">{d.topMatches}</CardTitle>
              <CardDescription>{d.topMatchesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {topMatches.length === 0 && <EmptyRow text={d.topMatchesEmpty} />}
              {topMatches.map((l) => (
                <ListingRow key={l.id} listing={l} />
              ))}
            </CardContent>
          </Card>

          <TrendsCard
            imports={importsByDay}
            districtCosts={districtCosts}
            labels={{
              title: d.trendsTitle,
              desc: d.trendsDesc,
              imports: d.trendsImports,
              importsEmpty: d.trendsImportsEmpty,
              costs: d.trendsCosts,
              costsEmpty: d.trendsCostsEmpty,
            }}
          />

          <Card className="elevate">
            <CardHeader>
              <CardTitle className="text-base">{d.newSince}</CardTitle>
              <CardDescription>{d.newSinceDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {newListings.length === 0 && <EmptyRow text={d.newSinceEmpty} />}
              {newListings.slice(0, 8).map((l) => (
                <ListingRow key={l.id} listing={l} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="elevate">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" /> {d.urgent}
                {urgent.length > 0 && (
                  <span className="ml-auto rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-warning">
                    {urgent.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {urgent.length === 0 && <EmptyRow text={d.urgentEmpty} />}
              {urgent.slice(0, 6).map((l) => (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className="block rounded-lg border border-border p-2.5 transition-colors hover:border-warning/40 hover:bg-warning/5"
                >
                  <div className="text-sm font-medium leading-tight line-clamp-2">
                    {l.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {l.status === "NEW" && l.importedAt < threeDaysAgo
                      ? d.urgentStaleNew
                      : d.urgentHighScore}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="elevate">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="size-4 text-muted-foreground" />{" "}
                {d.sourcesHealth}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{p.displayName}</span>
                  <HealthPill
                    status={p.healthStatus}
                    label={d[`health${p.healthStatus}`]}
                  />
                </div>
              ))}
              {providers.length === 0 && <EmptyRow text={d.sourcesEmpty} />}
            </CardContent>
          </Card>

          <Card className="elevate">
            <CardHeader>
              <CardTitle className="text-base">{d.savedSearches}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {savedSearches.length === 0 && (
                <EmptyRow text={d.savedSearchesEmpty} />
              )}
              {savedSearches.map((s) => (
                <a
                  key={s.id}
                  href={s.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="-mx-2 flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="truncate">{s.label}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                    {s.provider.displayName}
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="elevate py-4 transition-colors hover:ring-primary/25">
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </div>
          {hint && (
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground/70 line-clamp-2">
              {hint}
            </div>
          )}
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

const HEALTH_TONE: Record<ProviderHealth, string> = {
  OK: "bg-success",
  DEGRADED: "bg-warning",
  DOWN: "bg-danger",
  UNKNOWN: "bg-muted-foreground/40",
};

function HealthPill({
  status,
  label,
}: {
  status: ProviderHealth;
  label: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/75">
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", HEALTH_TONE[status])}
      />
      {label}
    </span>
  );
}
