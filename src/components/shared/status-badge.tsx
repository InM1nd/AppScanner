"use client";

import { useTranslations } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { ListingStatus } from "@prisma/client";

// Status reads as a neutral chip with a coloured dot: the pipeline stage is
// carried by the dot, so the loud colour ramp stays reserved for ScoreBadge.
const STATUS_DOT: Record<ListingStatus, string> = {
  NEW: "bg-info",
  REVIEWING: "bg-info/60",
  CONTACTED: "bg-warning",
  VIEWING: "bg-warning/70",
  SHORTLISTED: "bg-success",
  REJECTED: "bg-danger",
  ARCHIVED: "bg-muted-foreground/50",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ListingStatus;
  className?: string;
}) {
  const { t } = useTranslations();
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 text-xs font-medium whitespace-nowrap text-foreground/75",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
      />
      {t(`status.${status}`)}
    </span>
  );
}
