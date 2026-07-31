"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  updateSearchProfileAction,
  updateScoringWeightsAction,
} from "@/app/actions";
import type { SearchProfileFormValue } from "./search-profile-form";
import type { ScoringWeights } from "@/types/search-profile";
import { useTranslations } from "@/i18n/locale-context";

export function ProfileExportImport({
  profile,
  weights,
}: {
  profile: SearchProfileFormValue;
  weights: ScoringWeights;
}) {
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ profile, weights }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "appscanner-profile.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.profile) await updateSearchProfileAction(parsed.profile);
      if (parsed.weights) await updateScoringWeightsAction(parsed.weights);
      toast.success("Profile imported. Reload to see changes.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid profile JSON.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("settings.exportImport")}
        </CardTitle>
        <CardDescription>{t("settings.exportImportDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" onClick={exportJson}>
          {t("settings.exportJson")}
        </Button>
        <Button
          variant="outline"
          disabled={importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? t("settings.importing") : t("settings.importJson")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importJson(file);
          }}
        />
      </CardContent>
    </Card>
  );
}
