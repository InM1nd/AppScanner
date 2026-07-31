import { getCurrentUser, getActiveSearchProfile } from "@/server/current-user";
import { toDomainSearchProfile } from "@/server/search-profile-mapper";
import { isTelegramConfigured } from "@/lib/telegram";
import { SearchProfileForm } from "@/components/settings/search-profile-form";
import { ScoringWeightsForm } from "@/components/settings/scoring-weights-form";
import { TelegramTestPanel } from "@/components/settings/telegram-test-panel";
import { ProfileExportImport } from "@/components/settings/profile-export-import";
import { RefreshListingsPanel } from "@/components/settings/refresh-listings-panel";
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
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

      <SearchProfileForm initial={profileFormValue} />
      <ScoringWeightsForm initial={profile.scoringWeights} />
      <TelegramTestPanel configured={isTelegramConfigured()} />

      <Card>
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

      <ProfileExportImport
        profile={profileFormValue}
        weights={profile.scoringWeights}
      />

      <RefreshListingsPanel />

      <div>
        <h2 className="text-lg font-semibold mb-3">{s.providerSetup}</h2>
        <ProviderSetupPanel />
      </div>
    </div>
  );
}
