"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { addNoteAction } from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";

interface NoteVM {
  id: string;
  body: string;
  createdAt: Date;
}

export function NotesSection({
  listingId,
  notes,
}: {
  listingId: string;
  notes: NoteVM[];
}) {
  const { t } = useTranslations();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      await addNoteAction(listingId, body.trim());
      setBody("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("listingDetail.notes")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("listingDetail.addNote")}
            className="min-h-16"
          />
          <Button onClick={submit} disabled={pending || !body.trim()}>
            {t("listingDetail.add")}
          </Button>
        </div>
        <div className="space-y-2">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("listingDetail.noNotes")}
            </p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md bg-muted/50 p-2.5 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatRelativeTime(n.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
