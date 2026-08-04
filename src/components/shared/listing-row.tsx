import Link from "next/link";
import { Inbox } from "lucide-react";
import { formatEur, formatRelativeTime, districtLabel } from "@/lib/format";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ListingCard } from "@/server/queries";

export function ListingRow({
  listing,
  meta,
}: {
  listing: ListingCard;
  meta?: React.ReactNode;
}) {
  const completeness = listing.scoreBreakdown?.dataCompleteness ?? 0;
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/40"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{listing.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {districtLabel(listing.district)} ·{" "}
            {formatEur(
              listing.monthlyLikelyTotal
                ? Number(listing.monthlyLikelyTotal)
                : null,
            )}
            /mo · {formatRelativeTime(listing.importedAt)}
          </span>
          {meta}
        </div>
      </div>
      <StatusBadge status={listing.status} className="hidden sm:inline-flex" />
      <ScoreBadge
        score={listing.scoreBreakdown?.totalScore ?? 0}
        isZeroed={listing.scoreBreakdown?.isZeroed}
      />
      <div
        className="hidden w-20 shrink-0 items-center gap-2 sm:flex"
        title={`${completeness}% data completeness`}
      >
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground/30"
            style={{ width: `${completeness}%` }}
          />
        </div>
        <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground/70">
          {completeness}%
        </span>
      </div>
    </Link>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-7 text-center">
      <Inbox className="size-5 text-muted-foreground/40" />
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
