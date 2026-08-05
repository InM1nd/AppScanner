"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateAiExtractionEnabledAction } from "@/app/actions";

export function AiExtractionPanel({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateAiExtractionEnabledAction(next);
      } catch (cause) {
        setEnabled(!next);
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not update AI extraction.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI money-field extraction</CardTitle>
        <CardDescription>
          When a listing&apos;s price breakdown (heating, electricity, deposit,
          fees) is only stated in free text, DeepSeek fills it in from the
          description. Applies to new imports only — the hourly refresh never
          calls it, since re-fetched description text doesn&apos;t change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch
            aria-label="AI money-field extraction"
            checked={enabled}
            onCheckedChange={toggle}
            disabled={pending}
          />
          {enabled ? "Enabled" : "Disabled"}
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
