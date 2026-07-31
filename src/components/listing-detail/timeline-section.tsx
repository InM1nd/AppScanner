import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, enumLabel } from "@/lib/format";

interface SnapshotVM {
  id: string;
  capturedAt: Date;
  changeType: string;
  changeSummary: string | null;
}

export function TimelineSection({
  snapshots,
  title = "Timeline",
}: {
  snapshots: SnapshotVM[];
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {snapshots.map((s) => (
          <div key={s.id} className="flex gap-3 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <div className="font-medium">{enumLabel(s.changeType)}</div>
              <div className="text-muted-foreground text-xs">
                {s.changeSummary} · {formatRelativeTime(s.capturedAt)}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
