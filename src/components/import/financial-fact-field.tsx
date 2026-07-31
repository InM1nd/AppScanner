"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FinancialFact } from "@/types/listing";

export function FinancialFactField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FinancialFact;
  onChange: (next: FinancialFact) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-1.5">
        <Input
          type="number"
          aria-label={`${label} amount`}
          placeholder="Amount"
          className="h-8 text-sm"
          value={value.amount ?? ""}
          onChange={(e) => {
            const amount =
              e.target.value === "" ? null : Number(e.target.value);
            onChange({
              ...value,
              amount,
              confidence:
                amount === null
                  ? "UNKNOWN"
                  : value.confidence === "UNKNOWN"
                    ? "ESTIMATE"
                    : value.confidence,
            });
          }}
        />
        <Select
          value={value.confidence}
          onValueChange={(v) =>
            onChange({ ...value, confidence: v as FinancialFact["confidence"] })
          }
        >
          <SelectTrigger
            className="h-8 w-28 text-xs"
            aria-label={`${label} confidence`}
          >
            <SelectValue>
              {(v: string) =>
                ({ EXACT: "Exact", ESTIMATE: "Estimate", UNKNOWN: "Unknown" })[
                  v
                ] ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXACT">Exact</SelectItem>
            <SelectItem value="ESTIMATE">Estimate</SelectItem>
            <SelectItem value="UNKNOWN">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        aria-label={`${label} source`}
        placeholder="Source (where this came from)"
        className="h-7 text-xs"
        value={value.sourceText ?? ""}
        onChange={(e) =>
          onChange({ ...value, sourceText: e.target.value || null })
        }
      />
    </div>
  );
}
