"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { refreshAllListingsAction } from "@/app/actions";

export function RefreshListingsPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await refreshAllListingsAction();
        if ("queued" in res) {
          setResult(
            "Refresh queued. Progress is available in Inngest and provider health.",
          );
          return;
        }
        if (typeof res.skipped === "string") {
          setResult("A refresh is already running.");
          return;
        }
        setResult(
          `Checked ${res.checked} · updated ${res.updated} · marked reserved ${res.removedReserved} · marked gone ${res.removedGone} · skipped ${res.skipped}`,
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not refresh listings.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Refresh listings from source
        </CardTitle>
        <CardDescription>
          Re-fetches supported listings, updates confirmed fields, and records
          reserved/gone source state without deleting your history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button onClick={run} disabled={pending} variant="outline">
          {pending ? "Refreshing…" : "Refresh all now"}
        </Button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
