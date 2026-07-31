import { ImportWizard } from "@/components/import/import-wizard";
import { ProviderSetupPanel } from "@/components/import/provider-setup-panel";
import { getDictionary } from "@/i18n/server";

export default async function ImportPage() {
  const { dict } = await getDictionary();
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.import.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dict.import.subtitle}
        </p>
      </div>
      <ImportWizard setupPanel={<ProviderSetupPanel />} />
    </div>
  );
}
