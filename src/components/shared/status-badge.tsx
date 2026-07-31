"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/locale-context";
import type { ListingStatus } from "@prisma/client";

const STATUS_STYLES: Record<ListingStatus, string> = {
  NEW: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  REVIEWING: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  CONTACTED: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  VIEWING: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  SHORTLISTED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  REJECTED: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  const { t } = useTranslations();
  return (
    <Badge className={`${STATUS_STYLES[status]} border-0 font-medium`}>
      {t(`status.${status}`)}
    </Badge>
  );
}
