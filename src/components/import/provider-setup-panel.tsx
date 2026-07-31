import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { providerRegistry } from "@/providers";
import { listSavedSearches } from "@/server/saved-searches";
import { SavedSearchesEditor } from "@/components/settings/saved-searches-editor";
import type { ProviderName } from "@/types/enums";

export async function ProviderSetupPanel() {
  const savedSearches = await listSavedSearches();

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {Object.entries(providerRegistry).map(([providerName, provider]) => (
        <Card key={provider.name}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              {provider.name}
              <div className="flex gap-1">
                {provider.discoverListingUrls && (
                  <Badge className="text-[11px]">auto-crawled</Badge>
                )}
                <Badge variant="outline" className="text-[11px]">
                  {provider.parseEmailAlert ? "URL + email alerts" : "URL only"}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="space-y-2 text-sm">
              {provider.getSetupInstructions().map((step) => (
                <li key={step.step} className="flex gap-2">
                  <span className="font-semibold text-primary">
                    {step.step}.
                  </span>
                  <div>
                    <div className="font-medium">{step.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {step.description}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {provider.discoverListingUrls && (
              <SavedSearchesEditor
                providerName={providerName as ProviderName}
                initial={savedSearches
                  .filter((s) => s.provider.name === providerName)
                  .map((s) => ({
                    id: s.id,
                    label: s.label,
                    searchUrl: s.searchUrl,
                  }))}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
