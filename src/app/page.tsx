import Link from "next/link";
import { db } from "@/lib/db";
import { listAllListings } from "@/server/queries";
import { formatEur, formatRelativeTime, districtLabel } from "@/lib/format";
import { daysAgo } from "@/lib/time";
import { getDictionary } from "@/i18n/server";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { TrendsCard } from "@/components/dashboard/trends-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Radio,
  TrendingUp,
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

  const topMatches = [...listings]
    .filter(
      (l) =>
        l.scoreBreakdown &&
        l.scoreBreakdown.totalScore >= 70 &&
        l.scoreBreakdown.dataCompleteness >= 70 &&
        !l.scoreBreakdown.isZeroed &&
        !["REJECTED", "ARCHIVED"].includes(l.status),
    )
    .sort(
      (a, b) =>
        (b.scoreBreakdown?.totalScore ?? 0) -
        (a.scoreBreakdown?.totalScore ?? 0),
    )
    .slice(0, 5);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{d.subtitle}</p>
        </div>
        <Link
          href="/import"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3.5 py-2 hover:opacity-90 transition-opacity"
        >
          {d.importListing} <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={d.statActive}
          value={String(activeCount)}
          icon={Building2}
        />
        <StatCard
          label={d.statShortlisted}
          value={String(shortlistedCount)}
          icon={TrendingUp}
        />
        <StatCard
          label={d.statAvgCost}
          value={avgKnownCost !== null ? formatEur(avgKnownCost) : "—"}
          icon={TrendingUp}
        />
        <StatCard
          label={d.statAvgScore}
          value={avgScore !== null ? `${avgScore}/100` : "—"}
          icon={TrendingUp}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.topMatches}</CardTitle>
              <CardDescription>{d.topMatchesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.newSince}</CardTitle>
              <CardDescription>{d.newSinceDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {newListings.length === 0 && <EmptyRow text={d.newSinceEmpty} />}
              {newListings.slice(0, 8).map((l) => (
                <ListingRow key={l.id} listing={l} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> {d.urgent}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {urgent.length === 0 && <EmptyRow text={d.urgentEmpty} />}
              {urgent.slice(0, 6).map((l) => (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className="block rounded-md border border-border p-2.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-sm font-medium leading-tight">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="size-4" /> {d.sourcesHealth}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{p.displayName}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {p.healthStatus}
                  </Badge>
                </div>
              ))}
              {providers.length === 0 && <EmptyRow text={d.sourcesEmpty} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.savedSearches}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedSearches.length === 0 && (
                <EmptyRow text={d.savedSearchesEmpty} />
              )}
              {savedSearches.map((s) => (
                <a
                  key={s.id}
                  href={s.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm hover:underline"
                >
                  {s.label}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({s.provider.displayName})
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
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center justify-between px-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold tabular-nums mt-0.5">
            {value}
          </div>
        </div>
        <Icon className="size-5 text-muted-foreground/50" />
      </CardContent>
    </Card>
  );
}

function ListingRow({
  listing,
}: {
  listing: Awaited<ReturnType<typeof listAllListings>>[number];
}) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{listing.title}</div>
        <div className="text-xs text-muted-foreground">
          {districtLabel(listing.district)} ·{" "}
          {formatEur(
            listing.monthlyLikelyTotal
              ? Number(listing.monthlyLikelyTotal)
              : null,
          )}
          /mo · {formatRelativeTime(listing.importedAt)}
        </div>
      </div>
      <StatusBadge status={listing.status} />
      <ScoreBadge
        score={listing.scoreBreakdown?.totalScore ?? 0}
        isZeroed={listing.scoreBreakdown?.isZeroed}
      />
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {listing.scoreBreakdown?.dataCompleteness ?? 0}%
      </span>
    </Link>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-3 px-1">{text}</div>;
}
