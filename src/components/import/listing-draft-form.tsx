"use client";

import { useEffect, useState, isValidElement, cloneElement } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FinancialFactField } from "./financial-fact-field";
import { EnumField } from "./enum-field";
import { validateListingDraft } from "@/lib/validation";
import type { NormalizedListing } from "@/types/listing";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "@/i18n/locale-context";

const MONEY_FIELDS: { key: keyof NormalizedListing; label: string }[] = [
  { key: "baseRent", label: "Base rent" },
  { key: "operatingCosts", label: "Operating costs (BK)" },
  { key: "heatingCost", label: "Heating" },
  { key: "hotWaterCost", label: "Hot water" },
  { key: "electricityEstimate", label: "Electricity (estimate, separate)" },
  { key: "internetEstimate", label: "Internet (estimate, separate)" },
  { key: "parkingMonthlyCost", label: "Parking (monthly)" },
  { key: "deposit", label: "Deposit" },
  { key: "commission", label: "Commission" },
  { key: "contractFee", label: "Contract fee" },
];

export function ListingDraftForm({
  initial,
  onSave,
  saving,
}: {
  initial: NormalizedListing;
  onSave: (draft: NormalizedListing) => void;
  saving?: boolean;
}) {
  const { t } = useTranslations();
  const [draft, setDraft] = useState<NormalizedListing>(initial);
  const validation = validateListingDraft(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function set<K extends keyof NormalizedListing>(
    key: K,
    value: NormalizedListing[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <b>Provenance:</b> {draft.importMethod.replace(/_/g, " ").toLowerCase()}
        . Review every confidence badge; leave facts unknown when the source
        does not confirm them.
        {dirty && <span className="ml-2 text-amber-700">Unsaved changes</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Title">
          <Input
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Canonical URL">
          <Input
            value={draft.canonicalUrl}
            onChange={(e) => set("canonicalUrl", e.target.value)}
          />
        </Field>
        <EnumField
          label="Listing type"
          value={draft.listingType}
          options={["RENTAL", "SALE", "SHARED_ROOM", "UNKNOWN"]}
          onChange={(v) => set("listingType", v as never)}
        />
        <EnumField
          label="Contract type"
          value={draft.contractType}
          options={["UNLIMITED", "FIXED_TERM", "TEMPORARY", "UNKNOWN"]}
          onChange={(v) => set("contractType", v as never)}
        />
        <Field label="Address">
          <Input
            value={draft.address ?? ""}
            onChange={(e) => set("address", e.target.value || null)}
          />
        </Field>
        <Field label="Postal code">
          <Input
            value={draft.postalCode ?? ""}
            onChange={(e) => set("postalCode", e.target.value || null)}
          />
        </Field>
        <Field label="District">
          <Input
            type="number"
            value={draft.district ?? ""}
            onChange={(e) =>
              set("district", e.target.value ? Number(e.target.value) : null)
            }
          />
        </Field>
        <Field label="Rooms">
          <Input
            type="number"
            step="0.5"
            value={draft.rooms ?? ""}
            onChange={(e) =>
              set("rooms", e.target.value ? Number(e.target.value) : null)
            }
          />
        </Field>
        <Field label="Square meters">
          <Input
            type="number"
            value={draft.squareMeters ?? ""}
            onChange={(e) =>
              set(
                "squareMeters",
                e.target.value ? Number(e.target.value) : null,
              )
            }
          />
        </Field>
        <EnumField
          label="Separate bedroom"
          value={draft.hasSeparateBedroom}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={(v) => set("hasSeparateBedroom", v as never)}
        />
        <EnumField
          label="Furnished level"
          value={draft.furnishedLevel}
          options={["UNFURNISHED", "PARTLY_FURNISHED", "FURNISHED", "UNKNOWN"]}
          onChange={(v) => set("furnishedLevel", v as never)}
        />
        <Field label="Availability date">
          <Input
            type="date"
            value={
              draft.availabilityDate
                ? new Date(draft.availabilityDate).toISOString().slice(0, 10)
                : ""
            }
            onChange={(e) =>
              set(
                "availabilityDate",
                e.target.value ? new Date(e.target.value) : null,
              )
            }
          />
        </Field>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Financials</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MONEY_FIELDS.map(({ key, label }) => (
            <FinancialFactField
              key={key}
              label={label}
              value={draft[key] as never}
              onChange={(v) => set(key, v as never)}
            />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">
          Amenities (confirmed only — leave Unknown if unsure)
        </h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <EnumField
            label="Kitchen"
            value={draft.kitchen}
            options={["FITTED", "BASIC", "NONE", "UNKNOWN"]}
            onChange={(v) => set("kitchen", v as never)}
          />
          <EnumField
            label="Washing machine"
            value={draft.washingMachine}
            options={["MACHINE_INCLUDED", "CONNECTION_ONLY", "NONE", "UNKNOWN"]}
            onChange={(v) => set("washingMachine", v as never)}
          />
          <EnumField
            label="Parking"
            value={draft.parkingAvailability}
            options={["INCLUDED", "AVAILABLE_EXTRA_COST", "NONE", "UNKNOWN"]}
            onChange={(v) => set("parkingAvailability", v as never)}
          />
          <EnumField
            label="Elevator"
            value={draft.elevator}
            options={["YES", "NO", "UNKNOWN"]}
            onChange={(v) => set("elevator", v as never)}
          />
          <EnumField
            label="Balcony/loggia"
            value={draft.balcony}
            options={["YES", "NO", "UNKNOWN"]}
            onChange={(v) => set("balcony", v as never)}
          />
          <EnumField
            label="Air conditioning"
            value={draft.airConditioning}
            options={["YES", "NO", "UNKNOWN"]}
            onChange={(v) => set("airConditioning", v as never)}
          />
          <EnumField
            label="Storage cellar"
            value={draft.storage}
            options={["YES", "NO", "UNKNOWN"]}
            onChange={(v) => set("storage", v as never)}
          />
          <EnumField
            label="Quiet/courtyard"
            value={draft.quietCourtyardSignal}
            options={["YES", "NO", "UNKNOWN"]}
            onChange={(v) => set("quietCourtyardSignal", v as never)}
          />
          <EnumField
            label="Newer/renovated"
            value={draft.newerOrRenovatedSignal}
            options={["YES", "NO", "UNKNOWN"]}
            onChange={(v) => set("newerOrRenovatedSignal", v as never)}
          />
          <EnumField
            label="Heating type"
            value={draft.heatingType}
            options={[
              "DISTRICT",
              "GAS",
              "ELECTRIC",
              "FLOOR",
              "OTHER",
              "UNKNOWN",
            ]}
            onChange={(v) => set("heatingType", v as never)}
          />
          <Field label="Energy rating">
            <Input
              value={draft.energyRating ?? ""}
              onChange={(e) => set("energyRating", e.target.value || null)}
            />
          </Field>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Description">
          <Textarea
            rows={4}
            value={draft.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
          />
        </Field>
        <div className="space-y-3">
          <Field label="Photo URLs (one per line)">
            <Textarea
              rows={4}
              value={draft.photos.join("\n")}
              onChange={(e) =>
                set(
                  "photos",
                  e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
          <Field label="Contact method">
            <Input
              value={draft.contactMethod ?? ""}
              onChange={(e) => set("contactMethod", e.target.value || null)}
            />
          </Field>
        </div>
      </div>

      {validation.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-0.5">
              {validation.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {!validation.valid && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-0.5">
              {validation.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="relative z-10 pt-1">
        <Button
          disabled={!validation.valid || saving}
          onClick={() => onSave(draft)}
        >
          {saving ? t("common.saving") : t("import.saveListing")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
