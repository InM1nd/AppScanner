"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateCommuteAction } from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";

interface CommuteEstimateVM {
  id: string;
  provider: string;
  durationMinutes: number | null;
  walkingMinutes: number | null;
  transfers: number | null;
  routeSummary: string | null;
  rating: string;
  calculatedAt: Date;
}

export function CommuteCard({
  listingId,
  hasCoordinates,
  estimates,
}: {
  listingId: string;
  hasCoordinates: boolean;
  estimates: CommuteEstimateVM[];
}) {
  const { t } = useTranslations();
  const [pending, startTransition] = useTransition();
  const latest = estimates[0];

  function calculate() {
    startTransition(async () => {
      try {
        const res = await calculateCommuteAction(listingId);
        if ("queued" in res && res.queued) {
          toast.success("Commute calculation queued.");
        } else if (!res.calculated) {
          toast.error(
            "Commute could not be calculated (no route result — never invented).",
          );
        } else {
          toast.success("Commute updated.");
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not start commute calculation.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t("listingDetail.commuteTitle")}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !hasCoordinates}
          onClick={calculate}
        >
          {pending ? "…" : t("listingDetail.recalculate")}
        </Button>
      </CardHeader>
      <CardContent>
        {!hasCoordinates ? (
          <p className="text-sm text-muted-foreground">
            No coordinates for this listing — geocode the address to enable
            commute calculation.
          </p>
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">
            Commute not calculated.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold tabular-nums">
                {latest.durationMinutes} {t("common.unitMin")}
              </span>
              <Badge variant="outline">{latest.rating.toLowerCase()}</Badge>
              <Badge variant="secondary" className="text-[10px]">
                {latest.provider}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {latest.walkingMinutes !== null &&
                `${latest.walkingMinutes} min walking · `}
              {latest.transfers !== null &&
                `${latest.transfers} transfer${latest.transfers === 1 ? "" : "s"} · `}
              {latest.routeSummary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
