"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "@/i18n/locale-context";

export function ViewingChecklist() {
  const { t, tList, locale } = useTranslations();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const list = tList("listingDetail.viewingQuestions");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("listingDetail.viewingChecklist")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.map((q, i) => (
          <label
            key={`${locale}-${i}`}
            className="flex items-start gap-2 text-sm cursor-pointer"
          >
            <Checkbox
              checked={checked.has(i)}
              onCheckedChange={(v) => {
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (v) next.add(i);
                  else next.delete(i);
                  return next;
                });
              }}
              className="mt-0.5"
            />
            <span
              className={
                checked.has(i) ? "line-through text-muted-foreground" : ""
              }
            >
              {q}
            </span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
