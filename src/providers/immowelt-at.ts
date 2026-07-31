import { createUrlOnlyProvider } from "./url-only-provider-factory";

export const immoweltAtProvider = createUrlOnlyProvider({
  name: "ImmoWelt Austria",
  domains: ["immowelt.at", "www.immowelt.at"],
  sourceListingIdPattern: /expose\/([a-zA-Z0-9]+)/i,
  listingUrlPattern:
    /https?:\/\/(?:www\.)?immowelt\.at\/expose\/[a-zA-Z0-9]+[^\s"<>]*/i,
  buildSearchUrls: () => [
    {
      label: "ImmoWelt AT — Wohnungen mieten in Wien",
      url: "https://www.immowelt.at/liste/wien/wohnungen/mieten",
      description:
        "Open this, then apply district/price/room filters and save the search.",
    },
  ],
  setupInstructions: [
    {
      step: 1,
      title: "Open ImmoWelt rentals for Vienna",
      description: "Go to immowelt.at → Mieten → Wien.",
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
