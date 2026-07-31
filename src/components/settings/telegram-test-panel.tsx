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
import { Badge } from "@/components/ui/badge";
import { sendTelegramTestAction } from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";

export function TelegramTestPanel({ configured }: { configured: boolean }) {
  const { t } = useTranslations();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function test() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await sendTelegramTestAction();
        if (res.sent) {
          setResult("Test notification sent.");
        } else {
          setError(res.reason);
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not send the test notification.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {t("settings.telegram")}
          <Badge
            variant={configured ? "default" : "outline"}
            className="text-[11px]"
          >
            {configured
              ? t("settings.telegramConfigured")
              : t("settings.telegramNotConfigured")}
          </Badge>
        </CardTitle>
        <CardDescription>{t("settings.telegramDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button onClick={test} disabled={pending} variant="outline">
          {pending ? t("settings.sending") : t("settings.sendTest")}
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
