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
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n/locale-context";
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

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <Button
          key={a.status}
          size="sm"
          variant={currentStatus === a.status ? "default" : "outline"}
          disabled={pending || refreshing}
          onClick={() => setStatus(a.status)}
        >
          {t(a.key)}
        </Button>
      ))}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || refreshing}
        onClick={toggleWatch}
      >
        {isWatching ? (
          <Heart className="size-4 fill-current" />
        ) : (
          <HeartOff className="size-4" />
        )}
        {isWatching ? t("listingDetail.watching") : t("listingDetail.watch")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || refreshing}
        onClick={refreshFromSource}
      >
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing…" : "Refresh from source"}
      </Button>
      <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-2 sm:w-auto sm:border-0 sm:pt-0">
        <Input
          aria-label="Viewing date and time"
          type="datetime-local"
          value={viewingAt}
          onChange={(event) => setViewingAt(event.target.value)}
          className="w-auto"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !viewingAt}
          onClick={scheduleViewing}
        >
          Schedule viewing
        </Button>
      </div>
    </div>
  );
}
