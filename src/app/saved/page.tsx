import { listSavedListings } from "@/server/queries";
import { getDictionary } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { ListingRow, EmptyRow } from "@/components/shared/listing-row";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Bookmark, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const { dict } = await getDictionary();
  const s = dict.saved;
  const listings = await listSavedListings();

  const shortlisted = listings
    .filter((l) => l.status === "SHORTLISTED")
    .sort(
      (a, b) =>
        (b.scoreBreakdown?.totalScore ?? 0) -
        (a.scoreBreakdown?.totalScore ?? 0),
    );

  const watchlisted = listings
    .filter((l) => l.watchlistItems.length > 0)
    .sort(
      (a, b) =>
        b.watchlistItems[0].addedAt.getTime() -
        a.watchlistItems[0].addedAt.getTime(),
    );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{s.subtitle}</p>
      </div>

      <Card className="elevate">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bookmark className="size-4 text-muted-foreground" />
            {s.shortlisted}
            {shortlisted.length > 0 && (
              <span className="ml-auto rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-success">
                {shortlisted.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>{s.shortlistedDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {shortlisted.length === 0 && <EmptyRow text={s.shortlistedEmpty} />}
          {shortlisted.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </CardContent>
      </Card>

      <Card className="elevate">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            {s.watchlist}
            {watchlisted.length > 0 && (
              <span className="ml-auto rounded-full bg-info/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-info">
                {watchlisted.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>{s.watchlistDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {watchlisted.length === 0 && <EmptyRow text={s.watchlistEmpty} />}
          {watchlisted.map((l) => {
            const scheduledAt = l.watchlistItems[0]?.scheduledViewingAt;
            return (
              <ListingRow
                key={l.id}
                listing={l}
                meta={
                  scheduledAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-info/12 px-1.5 py-0.5 text-[10px] font-medium text-info">
                      <CalendarClock className="size-3" />
                      {s.scheduledViewing} {formatDateTime(scheduledAt)}
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
