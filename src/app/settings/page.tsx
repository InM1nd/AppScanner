import { getCurrentUser, getActiveSearchProfile } from "@/server/current-user";
import { toDomainSearchProfile } from "@/server/search-profile-mapper";
import { isTelegramConfigured } from "@/lib/telegram";
import { SearchProfileForm } from "@/components/settings/search-profile-form";
import { ScoringWeightsForm } from "@/components/settings/scoring-weights-form";
import { TelegramTestPanel } from "@/components/settings/telegram-test-panel";
import { ProfileExportImport } from "@/components/settings/profile-export-import";
import { RefreshListingsPanel } from "@/components/settings/refresh-listings-panel";
import { AiExtractionPanel } from "@/components/settings/ai-extraction-panel";
import { ProviderSetupPanel } from "@/components/import/provider-setup-panel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/i18n/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { dict } = await getDictionary();
  const s = dict.settings;
  const user = await getCurrentUser();
  const profileRow = await getActiveSearchProfile(user.id);
  const profile = toDomainSearchProfile(profileRow);

  const profileFormValue = {
    ...profile,
    moveInEarliest: profile.moveInEarliest.toISOString(),
    moveInLatest: profile.moveInLatest.toISOString(),
  };

  const routingProvider =
    process.env.ROUTING_PROVIDER === "google" ? "google" : "mock";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{s.subtitle}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 text-right">
            {s.language}
          </p>
          <LanguageSwitcher variant="settings" />
        </div>
      </div>

      <Section title={s.sectionSearch} description={s.sectionSearchDesc}>
        <SearchProfileForm initial={profileFormValue} />
        <ScoringWeightsForm initial={profile.scoringWeights} />
      </Section>

      <Section
        title={s.sectionIntegrations}
        description={s.sectionIntegrationsDesc}
      >
        {/* Both are read-only status panels of the same shape, so a 2-up grid
            keeps them from eating a full screen of vertical space. */}
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:h-full">
          <TelegramTestPanel configured={isTelegramConfigured()} />
          <Card className="elevate">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {s.routingProvider}
                <Badge
                  variant={routingProvider === "google" ? "default" : "outline"}
                  className="text-[11px]"
                >
                  {routingProvider}
                </Badge>
              </CardTitle>
              <CardDescription>{s.routingProviderDesc}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section title={s.sectionData} description={s.sectionDataDesc}>
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:h-full">
          <ProfileExportImport
            profile={profileFormValue}
            weights={profile.scoringWeights}
          />
          <RefreshListingsPanel />
          <AiExtractionPanel initial={profileRow.aiExtractionEnabled} />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            {s.providerSetup}
          </h3>
          <ProviderSetupPanel />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border pb-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
