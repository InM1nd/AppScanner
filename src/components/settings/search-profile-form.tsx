"use client";

import {
  cloneElement,
  isValidElement,
  useState,
  useTransition,
  type ReactElement,
} from "react";
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
import { Switch } from "@/components/ui/switch";
import { updateSearchProfileAction } from "@/app/actions";
import { useTranslations } from "@/i18n/locale-context";
import { searchProfile, type SearchProfile } from "@/types/search-profile";

export type SearchProfileFormValue = Omit<
  SearchProfile,
  "moveInEarliest" | "moveInLatest"
> & {
  moveInEarliest: string;
  moveInLatest: string;
};

export function SearchProfileForm({
  initial,
}: {
  initial: SearchProfileFormValue;
}) {
  const { t } = useTranslations();
  const [value, setValue] = useState(initial);
  const [districtsText, setDistrictsText] = useState(
    initial.preferredDistricts.join(", "),
  );
  const [secondaryDistrictsText, setSecondaryDistrictsText] = useState(
    initial.secondaryDistricts.join(", "),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const payload = {
        ...value,
        preferredDistricts: parseDistricts(districtsText),
        secondaryDistricts: parseDistricts(secondaryDistrictsText),
      };
      const validated = searchProfile.safeParse(payload);
      if (!validated.success) {
        const message =
          validated.error.issues[0]?.message ?? "Invalid profile settings.";
        setError(message);
        toast.error(message);
        return;
      }
      setError(null);
      try {
        const res = await updateSearchProfileAction(payload);
        toast.success(
          res.queued
            ? "Saved; recalculation queued."
            : `${t("common.save")}: ${res.recalculated}`,
        );
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Could not save settings.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Card id="export-target">
      <CardHeader>
        <CardTitle className="text-base">
          {t("settings.searchCriteria")}
        </CardTitle>
        <CardDescription>{t("settings.searchCriteriaDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="City">
            <Input
              value={value.city}
              onChange={(e) =>
                setValue((v) => ({ ...v, city: e.target.value }))
              }
            />
          </Field>
          <Field label="Preferred districts (comma-separated)">
            <Input
              value={districtsText}
              onChange={(e) => setDistrictsText(e.target.value)}
            />
          </Field>
          <Field label="Secondary districts (comma-separated)">
            <Input
              value={secondaryDistrictsText}
              onChange={(e) => setSecondaryDistrictsText(e.target.value)}
            />
          </Field>
          <Field label="Target monthly min (€)">
            <Input
              type="number"
              value={value.targetMonthlyMin}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  targetMonthlyMin: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Target monthly max (€)">
            <Input
              type="number"
              value={value.targetMonthlyMax}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  targetMonthlyMax: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Absolute monthly max (€)">
            <Input
              type="number"
              value={value.absoluteMonthlyMax}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  absoluteMonthlyMax: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Max commute (minutes)">
            <Input
              type="number"
              min={1}
              value={value.maxCommuteMinutes}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  maxCommuteMinutes: Number(e.target.value),
                }))
              }
            />
          </Field>
          <Field label="Move-in earliest">
            <Input
              type="date"
              value={value.moveInEarliest.slice(0, 10)}
              onChange={(e) =>
                setValue((v) => ({ ...v, moveInEarliest: e.target.value }))
              }
            />
          </Field>
          <Field label="Move-in latest">
            <Input
              type="date"
              value={value.moveInLatest.slice(0, 10)}
              onChange={(e) =>
                setValue((v) => ({ ...v, moveInLatest: e.target.value }))
              }
            />
          </Field>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium">
            Cost assumptions for missing data
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Used only in the likely all-in total when an advert provides no
            matching cost. These estimates never replace source facts and get
            half completeness credit.
          </p>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <Field label="Energy: heating, hot water & electricity (€/month)">
              <Input
                type="number"
                min={0}
                max={1000}
                step={5}
                value={value.energyMonthlyEstimate}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    energyMonthlyEstimate: Number(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Internet (€/month)">
              <Input
                type="number"
                min={0}
                max={1000}
                step={5}
                value={value.internetMonthlyEstimate}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    internetMonthlyEstimate: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Defaults: €130 energy (Statistics Austria, housing 2025 median) and
            €30 internet (rounded entry-level provider pricing).
          </p>
        </div>

        <div className="flex flex-wrap gap-6">
          <ToggleField
            label="Separate bedroom required"
            checked={value.requireSeparateBedroom}
            onChange={(c) =>
              setValue((v) => ({ ...v, requireSeparateBedroom: c }))
            }
          />
          <ToggleField
            label="Fitted kitchen required"
            checked={value.needsFittedKitchen}
            onChange={(c) => setValue((v) => ({ ...v, needsFittedKitchen: c }))}
          />
          <ToggleField
            label="Washing machine required"
            checked={value.needsWashingMachine}
            onChange={(c) =>
              setValue((v) => ({ ...v, needsWashingMachine: c }))
            }
          />
          <ToggleField
            label="Parking required (hard requirement)"
            checked={value.parkingRequired}
            onChange={(c) => setValue((v) => ({ ...v, parkingRequired: c }))}
          />
          <ToggleField
            label="Prefer no agent commission"
            checked={value.preferNoCommission}
            onChange={(c) => setValue((v) => ({ ...v, preferNoCommission: c }))}
          />
          <ToggleField
            label="Long-term only"
            checked={value.longTermOnly}
            onChange={(c) => setValue((v) => ({ ...v, longTermOnly: c }))}
          />
        </div>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Advanced commute and layout
          </summary>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <Field label="Minimum rooms">
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={value.minRooms}
                onChange={(e) =>
                  setValue((v) => ({ ...v, minRooms: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Work destination">
              <Input
                value={value.workDestinationLabel}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    workDestinationLabel: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Destination latitude">
              <Input
                type="number"
                step="any"
                value={value.workDestinationLat}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    workDestinationLat: Number(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Destination longitude">
              <Input
                type="number"
                step="any"
                value={value.workDestinationLng}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    workDestinationLng: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
        </details>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={pending}>
          {pending ? t("common.saving") : t("settings.saveRecalc")}
        </Button>
      </CardContent>
    </Card>
  );
}

function parseDistricts(input: string): number[] {
  return input
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  const id = `profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
