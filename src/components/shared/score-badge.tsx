import { cn } from "@/lib/utils";

function bandForScore(score: number) {
  if (score >= 80)
    return {
      label: "Excellent",
      classes:
        "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-500/30",
    };
  if (score >= 60)
    return {
      label: "Good",
      classes: "bg-sky-500/15 text-sky-700 dark:text-sky-400 ring-sky-500/30",
    };
  if (score >= 40)
    return {
      label: "Fair",
      classes:
        "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30",
    };
  return {
    label: "Weak",
    classes: "bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/30",
  };
}

export function ScoreBadge({
  score,
  isZeroed,
  size = "md",
}: {
  score: number;
  isZeroed?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  if (isZeroed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-muted text-muted-foreground ring-border">
        Excluded
      </span>
    );
  }
  const band = bandForScore(score);
  const sizeClasses =
    size === "lg"
      ? "text-base px-3 py-1"
      : size === "sm"
        ? "text-[11px] px-1.5 py-0"
        : "text-xs px-2 py-0.5";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset tabular-nums",
        band.classes,
        sizeClasses,
      )}
    >
      {score}
      <span className="font-normal">/100</span>
    </span>
  );
}
