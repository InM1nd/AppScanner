"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ListingDraftForm } from "./listing-draft-form";
import {
  importFromUrlAction,
  importFromEmailAction,
  finalizeImportJobAction,
  saveManualListingAction,
  getBlankManualDraftAction,
} from "@/app/actions";
import type { NormalizedListing } from "@/types/listing";
import type { ProviderName } from "@/types/enums";
import { useTranslations } from "@/i18n/locale-context";

const EMAIL_PROVIDERS: ProviderName[] = [
  "WILLHABEN",
  "IMMOSCOUT24_AT",
  "IMMOWELT_AT",
  "DER_STANDARD",
  "FINDMYHOME",
];

interface PendingJob {
  jobId: string;
  drafts: NormalizedListing[];
}

export function ImportWizard({ setupPanel }: { setupPanel: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslations();

  return (
    <Tabs defaultValue="url" className="space-y-4">
      <TabsList>
        <TabsTrigger value="url">{t("import.tabUrl")}</TabsTrigger>
        <TabsTrigger value="email">{t("import.tabEmail")}</TabsTrigger>
        <TabsTrigger value="manual">{t("import.tabManual")}</TabsTrigger>
        <TabsTrigger value="setup">{t("import.tabSetup")}</TabsTrigger>
      </TabsList>

      <TabsContent value="url">
        <UrlImport onSaved={() => router.push("/listings")} />
      </TabsContent>
      <TabsContent value="email">
        <EmailImport onSaved={() => router.push("/listings")} />
      </TabsContent>
      <TabsContent value="manual">
        <ManualImport onSaved={() => router.push("/listings")} />
      </TabsContent>
      <TabsContent value="setup">{setupPanel}</TabsContent>
    </Tabs>
  );
}

function UrlImport({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslations();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<PendingJob | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUrl() {
    setError(null);
    setLoading(true);
    try {
      const result = await importFromUrlAction(url);
      if (result.status === "FAILED") {
        const message = result.errorMessage ?? "Could not parse this URL.";
        setError(message);
        toast.error(message);
        setJob(null);
      } else {
        setJob({
          jobId: result.id,
          drafts: [result.rawParsed as unknown as NormalizedListing],
        });
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not import this URL.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function save(draft: NormalizedListing) {
    if (!job) return;
    setError(null);
    setSaving(true);
    try {
      await finalizeImportJobAction(job.jobId, draft);
      toast.success("Listing saved.");
      onSaved();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save listing.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex gap-2">
          <Input
            placeholder="https://www.willhaben.at/iad/immobilien/d/..."
            aria-label="Listing URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={fetchUrl} disabled={loading || !url}>
            {loading ? t("import.fetching") : t("import.fetch")}
          </Button>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {job && (
        <Card>
          <CardContent className="pt-6">
            <ListingDraftForm
              initial={job.drafts[0]}
              onSave={save}
              saving={saving}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmailImport({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslations();
  const [provider, setProvider] = useState<ProviderName>("WILLHABEN");
  const [rawEmail, setRawEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<PendingJob | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setError(null);
    setLoading(true);
    try {
      const result = await importFromEmailAction(provider, rawEmail);
      if (result.status === "FAILED") {
        const message =
          result.errorMessage ?? "No listings found in this email.";
        setError(message);
        toast.error(message);
        setJob(null);
      } else {
        setJob({
          jobId: result.id,
          drafts: result.rawParsed as unknown as NormalizedListing[],
        });
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not parse this email.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function save(index: number, draft: NormalizedListing) {
    if (!job) return;
    setError(null);
    setSavingIndex(index);
    try {
      await finalizeImportJobAction(job.jobId, draft);
      toast.success("Listing saved.");
      onSaved();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save listing.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Select
            value={provider}
            onValueChange={(v) => setProvider(v as ProviderName)}
          >
            <SelectTrigger className="w-56" aria-label="Email provider">
              <SelectValue>{(v: string) => v.replace(/_/g, " ")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EMAIL_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={8}
            placeholder="Paste the full alert email text here…"
            aria-label="Alert email text"
            value={rawEmail}
            onChange={(e) => setRawEmail(e.target.value)}
          />
          <Button onClick={parse} disabled={loading || !rawEmail}>
            {loading ? t("import.parsing") : t("import.parseEmail")}
          </Button>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {job?.drafts.map((draft, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-3">
              {i + 1} / {job.drafts.length}
            </p>
            <ListingDraftForm
              initial={draft}
              onSave={(d) => save(i, d)}
              saving={savingIndex === i}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ManualImport({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslations();
  const [draft, setDraft] = useState<NormalizedListing | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setStarting(true);
    try {
      setDraft(await getBlankManualDraftAction());
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not start manual import.";
      setError(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  async function save(d: NormalizedListing) {
    setError(null);
    setSaving(true);
    try {
      await saveManualListingAction(d);
      toast.success("Listing saved.");
      onSaved();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save listing.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-3">
            {t("import.manualHint")}
          </p>
          <Button onClick={start} disabled={starting}>
            {starting ? t("common.loading") : t("import.startManual")}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ListingDraftForm initial={draft} onSave={save} saving={saving} />
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
