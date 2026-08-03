export type SnapshotScalar = string | number | boolean | null;

export interface SnapshotFieldChange {
  [key: string]: SnapshotScalar;
  before: SnapshotScalar;
  after: SnapshotScalar;
}

export interface SnapshotDisplayField extends SnapshotFieldChange {
  field: string;
  hasBefore: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isScalar(value: unknown): value is SnapshotScalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function changedSnapshotFields(
  before: Record<string, SnapshotScalar>,
  after: Record<string, SnapshotScalar>,
): Record<string, SnapshotFieldChange> {
  const changes: Record<string, SnapshotFieldChange> = {};
  for (const field of new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ])) {
    const previous = before[field] ?? null;
    const next = after[field] ?? null;
    if (!Object.is(previous, next))
      changes[field] = { before: previous, after: next };
  }
  return changes;
}

export function readSnapshotFields(fields: unknown): SnapshotDisplayField[] {
  if (!isRecord(fields)) return [];

  if (isScalar(fields.from) && isScalar(fields.to)) {
    return [
      {
        field: "status",
        before: fields.from,
        after: fields.to,
        hasBefore: true,
      },
    ];
  }

  const result: SnapshotDisplayField[] = [];
  const consumed = new Set<string>();
  for (const [field, value] of Object.entries(fields)) {
    if (isRecord(value) && isScalar(value.before) && isScalar(value.after)) {
      result.push({
        field,
        before: value.before,
        after: value.after,
        hasBefore: true,
      });
      consumed.add(field);
      continue;
    }

    if (!field.endsWith("Before") || !isScalar(value)) continue;
    const base = field.slice(0, -"Before".length);
    const afterKey = `${base}After`;
    const after = fields[afterKey];
    if (!isScalar(after)) continue;
    result.push({ field: base, before: value, after, hasBefore: true });
    consumed.add(field);
    consumed.add(afterKey);
  }

  for (const [field, value] of Object.entries(fields)) {
    if (consumed.has(field) || !isScalar(value)) continue;
    result.push({
      field,
      before: null,
      after: value,
      hasBefore: false,
    });
  }
  return result;
}
