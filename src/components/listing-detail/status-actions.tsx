"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ListingStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  updateListingStatusAction,
  toggleWatchlistAction,
  refreshListingAction,
  scheduleViewingAction,
} from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import { Heart, HeartOff, RefreshCw } from "lucide-react";

const ACTIONS: { status: ListingStatus; key: string }[] = [
  { status: "CONTACTED", key: "listingDetail.markContacted" },
  { status: "VIEWING", key: "listingDetail.viewingBooked" },
  { status: "SHORTLISTED", key: "listingDetail.shortlist" },
  { status: "REJECTED", key: "listingDetail.reject" },
];

export function StatusActions({
  listingId,
  currentStatus,
  isWatching,
}: {
  listingId: string;
  currentStatus: ListingStatus;
  isWatching: boolean;
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [viewingAt, setViewingAt] = useState("");

  function setStatus(status: ListingStatus) {
    startTransition(async () => {
      try {
        await updateListingStatusAction(listingId, status);
        toast.success(t(`status.${status}`));
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update status.",
        );
      }
    });
  }

  function scheduleViewing() {
    startTransition(async () => {
      try {
        await scheduleViewingAction(listingId, viewingAt);
        toast.success("Viewing scheduled; Telegram reminder is armed.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not schedule viewing.",
        );
      }
    });
  }

  function toggleWatch() {
    startTransition(async () => {
      try {
        const res = await toggleWatchlistAction(listingId);
        toast.success(
          res.watching ? t("listingDetail.watching") : t("listingDetail.watch"),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not update the watchlist.",
        );
      }
    });
  }

  function refreshFromSource() {
    startRefresh(async () => {
      try {
        const response = await refreshListingAction(listingId);
        const { result } = response;
        if (result === "updated") {
          toast.success("Refreshed from source.");
          router.refresh();
        } else if (result === "queued") {
          toast.success("Refresh queued.");
        } else if (result === "marked_reserved") {
          toast.success(
            "Source marked this listing as reserved; it was kept in your history.",
          );
          router.refresh();
        } else if (result === "marked_gone") {
          toast.success(
            "Listing is gone from the source; it was kept in your history.",
          );
          router.refresh();
        } else {
          toast.error(
            ("error" in response && response.error) ||
              "Could not refresh this listing.",
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not refresh this listing.",
        );
      }
    });
  }

  const busy = pending || refreshing;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* Status progression reads as one segmented control so the current
          stage is obvious; everything else is secondary. */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("listingDetail.actionsStatus")}
        </span>
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {ACTIONS.map((a) => {
            const active = currentStatus === a.status;
            return (
              <button
                key={a.status}
                type="button"
                aria-pressed={active}
                disabled={busy}
                onClick={() => setStatus(a.status)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                  active
                    ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/10"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(a.key)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-6 w-px bg-border max-sm:hidden" />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={toggleWatch}>
          {isWatching ? (
            <Heart className="size-4 fill-current text-danger" />
          ) : (
            <HeartOff className="size-4" />
          )}
          {isWatching ? t("listingDetail.watching") : t("listingDetail.watch")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={refreshFromSource}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          {refreshing
            ? t("listingDetail.refreshing")
            : t("listingDetail.refreshFromSource")}
        </Button>

        <div className="flex items-center gap-2 rounded-lg border border-input py-1 pl-2.5 pr-1">
          <label
            htmlFor="viewing-at"
            className="text-xs whitespace-nowrap text-muted-foreground"
          >
            {t("listingDetail.viewingDateTime")}
          </label>
          <input
            id="viewing-at"
            type="datetime-local"
            value={viewingAt}
            onChange={(event) => setViewingAt(event.target.value)}
            className="bg-transparent text-xs text-foreground outline-none"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !viewingAt}
            onClick={scheduleViewing}
          >
            {t("listingDetail.scheduleViewing")}
          </Button>
        </div>
      </div>
    </div>
  );
}
