import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  formatEur,
  formatRelativeTime,
  enumLabel,
} from "@/lib/format";
import {
  readSnapshotFields,
  type SnapshotScalar,
} from "@/lib/listing-snapshot";

interface SnapshotVM {
  id: string;
  capturedAt: Date;
  changeType: string;
  changeSummary: string | null;
  fields: unknown;
}

function formatSnapshotValue(
  field: string,
  value: SnapshotScalar,
  unknownLabel: string,
) {
  if (value === null) return unknownLabel;
  if (field.endsWith("Amount") && typeof value === "number")
    return formatEur(value, true);
  if (field === "availabilityDate" && typeof value === "string")
    return formatDate(value);
  if (field === "squareMeters" && typeof value === "number")
    return `${value} m²`;
  if (
    typeof value === "string" &&
    ["status", "contractType", "furnishedLevel"].includes(field)
  )
    return enumLabel(value);
  return String(value);
}

export function TimelineSection({
  snapshots,
  title = "Timeline",
  fieldLabels,
  unknownLabel,
}: {
  snapshots: SnapshotVM[];
  title?: string;
  fieldLabels: Record<string, string>;
  unknownLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {snapshots.map((snapshot) => {
          const fields = readSnapshotFields(snapshot.fields);
          return (
            <div key={snapshot.id} className="flex gap-3 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">
                  {enumLabel(snapshot.changeType)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {snapshot.changeSummary ? `${snapshot.changeSummary} · ` : ""}
                  {formatRelativeTime(snapshot.capturedAt)}
                </div>
                {fields.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs">
                    {fields.map((change) => (
                      <li key={change.field}>
                        <span className="text-muted-foreground">
                          {fieldLabels[change.field] ?? enumLabel(change.field)}
                          :
                        </span>{" "}
                        {change.hasBefore && (
                          <>
                            {formatSnapshotValue(
                              change.field,
                              change.before,
                              unknownLabel,
                            )}{" "}
                            →{" "}
                          </>
                        )}
                        {formatSnapshotValue(
                          change.field,
                          change.after,
                          unknownLabel,
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
