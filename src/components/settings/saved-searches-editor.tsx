"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSavedSearchAction,
  deleteSavedSearchAction,
} from "@/app/actions";
import type { ProviderName } from "@/types/enums";

interface SavedSearch {
  id: string;
  label: string;
  searchUrl: string;
}

export function SavedSearchesEditor({
  providerName,
  initial,
}: {
  providerName: ProviderName;
  initial: SavedSearch[];
}) {
  const [searches, setSearches] = useState(initial);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    if (!url.trim()) return;
    startTransition(async () => {
      try {
        const { id } = await createSavedSearchAction(
          providerName,
          label.trim() || "Saved search",
          url.trim(),
        );
        setSearches((prev) => [
          { id, label: label.trim() || "Saved search", searchUrl: url.trim() },
          ...prev,
        ]);
        setLabel("");
        setUrl("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save this URL.");
      }
    });
  }

  function remove(id: string) {
    setError(null);
    const previousSearches = searches;
    setSearches((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      try {
        await deleteSavedSearchAction(id);
      } catch (cause) {
        setSearches(previousSearches);
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not remove this saved search.",
        );
      }
    });
  }

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="text-xs font-medium text-muted-foreground">
        Saved searches (crawled automatically)
      </div>
      {searches.length === 0 && (
        <p className="text-xs text-muted-foreground">
          None yet — paste a filtered search URL below.
        </p>
      )}
      <ul className="space-y-1">
        {searches.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs">
            <a
              href={s.searchUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate flex-1 text-primary hover:underline"
              title={s.searchUrl}
            >
              {s.label}
            </a>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              aria-label={`Remove ${s.label}`}
              onClick={() => remove(s.id)}
              disabled={pending}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          placeholder="Label"
          aria-label="Saved search label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-28 h-8 text-xs"
        />
        <Input
          placeholder="Filtered search URL"
          aria-label="Filtered search URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 h-8 text-xs"
        />
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={add}
          disabled={pending || !url.trim()}
        >
          Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
