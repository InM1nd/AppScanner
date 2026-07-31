import { createUrlOnlyProvider } from "./url-only-provider-factory";

export const derStandardProvider = createUrlOnlyProvider({
  name: "Der Standard Immobilien",
  domains: ["immobilien.derstandard.at"],
  sourceListingIdPattern: /\/(\d{6,})(?:[/?#]|$)/,
  listingUrlPattern:
    /https?:\/\/immobilien\.derstandard\.at\/[^\s"<>]+\/\d{6,}[^\s"<>]*/i,
  buildSearchUrls: () => [
    {
      label: "Der Standard Immobilien — Wohnungen mieten in Wien",
      url: "https://immobilien.derstandard.at/suche/wien/mieten-wohnung",
      description:
        "Open this, then apply district/price/room filters and save the search.",
    },
  ],
  setupInstructions: [
    {
      step: 1,
      title: "Open Der Standard Immobilien for Vienna",
      description: "Go to immobilien.derstandard.at → Mieten → Wien.",
    },
    {
      step: 2,
      title: "Apply your filters",
      description: "Districts, 2 rooms, price up to €1100.",
    },
    {
      step: 3,
      title: "Save the search & enable alerts",
      description: "Save the search and enable email notifications.",
    },
    {
      step: 4,
      title: "Forward or paste alerts here",
      description:
        "Use the Import → Paste alert email flow for each new alert.",
    },
  ],
});
