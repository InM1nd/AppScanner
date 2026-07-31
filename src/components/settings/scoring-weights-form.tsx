"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateScoringWeightsAction } from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";
import type { ScoringWeights } from "@/types/search-profile";

const KEYS: (keyof ScoringWeights)[] = [
  "budget",
  "commute",
  "layout",
  "condition",
  "parking",
  "moveIn",
  "contract",
  "infrastructure",
];

export function ScoringWeightsForm({ initial }: { initial: ScoringWeights }) {
  const { t } = useTranslations();
  const [weights, setWeights] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateScoringWeightsAction(weights);
        toast.success(
          res.queued
            ? "Weights saved; recalculation queued."
            : `${t("settings.saveRecalcAll")}: ${res.recalculated}`,
        );
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Could not save weights.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("settings.scoringWeights")}
        </CardTitle>
        <CardDescription
          className={
            Math.abs(total - 100) < 0.001 ? undefined : "text-destructive"
          }
        >
          {total} / 100 pts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {KEYS.map((key) => (
            <div key={key} className="space-y-1">
              <Label
                htmlFor={`weight-${key}`}
                className="text-xs font-medium text-muted-foreground"
              >
                {t(`scoreCategories.${key}`)}
              </Label>
              <Input
                id={`weight-${key}`}
                type="number"
                min={0}
                value={weights[key]}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
        </div>
        {Math.abs(total - 100) >= 0.001 && (
          <p role="alert" className="text-sm text-destructive">
            Weights must total exactly 100.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          onClick={submit}
          disabled={pending || Math.abs(total - 100) >= 0.001}
        >
          {pending ? t("common.saving") : t("settings.saveRecalcAll")}
        </Button>
      </CardContent>
    </Card>
  );
}
