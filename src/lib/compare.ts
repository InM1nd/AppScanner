/**
 * Indexes holding the winning value in a compare row.
 *
 * Returns an empty set unless at least two slots have a comparable number —
 * otherwise "best" would just mark the only listing that happens to have data,
 * which reads as a judgement the data does not support. Ties across every
 * present value are also unmarked: nothing won.
 */
export function bestIndexes(
  values: (number | null | undefined)[],
  direction: "min" | "max",
): Set<number> {
  const present = values
    .map((value, index) => ({ value, index }))
    .filter(
      (entry): entry is { value: number; index: number } =>
        typeof entry.value === "number" && Number.isFinite(entry.value),
    );
  if (present.length < 2) return new Set();

  const winner =
    direction === "min"
      ? Math.min(...present.map((entry) => entry.value))
      : Math.max(...present.map((entry) => entry.value));

  if (present.every((entry) => entry.value === winner)) return new Set();

  return new Set(
    present.filter((entry) => entry.value === winner).map((e) => e.index),
  );
}
