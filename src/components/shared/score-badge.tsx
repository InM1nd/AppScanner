import { cn } from "@/lib/utils";

// One quality ramp for score. Status hue lives on a separate axis (a dot in
// StatusBadge) so the two never compete for the same colour meaning.
function bandForScore(score: number) {
  if (score >= 80)
    return { label: "Excellent", classes: "bg-success/12 text-success" };
  if (score >= 60) return { label: "Good", classes: "bg-info/12 text-info" };
  if (score >= 40)
    return { label: "Fair", classes: "bg-warning/14 text-warning" };
  return { label: "Weak", classes: "bg-danger/12 text-danger" };
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
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
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
      title={band.label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums",
        band.classes,
        sizeClasses,
      )}
    >
      {score}
      <span className="font-normal opacity-60">/100</span>
    </span>
  );
}
