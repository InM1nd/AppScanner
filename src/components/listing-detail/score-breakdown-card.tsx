import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreBadge } from "@/components/shared/score-badge";
import type { Prisma } from "@prisma/client";

interface ScoreCategoryJson {
  key: string;
  label: string;
  points: number;
  max: number;
  reason: string;
  notCalculated?: boolean;
}

export function ScoreBreakdownCard({
  totalScore,
  dataCompleteness,
  isZeroed,
  zeroReason,
  categories,
  title = "Score breakdown",
  notCalculatedLabel = "not calculated",
}: {
  totalScore: number;
  dataCompleteness: number;
  isZeroed: boolean;
  zeroReason: string | null;
  categories: Prisma.JsonValue;
  title?: string;
  notCalculatedLabel?: string;
}) {
  const cats = (Array.isArray(categories)
    ? categories
    : []) as unknown as ScoreCategoryJson[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <ScoreBadge score={totalScore} isZeroed={isZeroed} size="lg" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
          <span className="text-muted-foreground">Data completeness</span>
          <span className="font-semibold tabular-nums">
            {dataCompleteness}%
          </span>
        </div>
        {isZeroed && zeroReason && (
          <p className="text-sm text-destructive font-medium">{zeroReason}</p>
        )}
        {cats.map((c) => (
          <div key={c.key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{c.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {c.notCalculated ? notCalculatedLabel : `${c.points}/${c.max}`}
              </span>
            </div>
            {!c.notCalculated && (
              <Progress
                value={c.max > 0 ? (c.points / c.max) * 100 : 0}
                className="h-1.5"
              />
            )}
            <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
