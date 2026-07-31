import { createUrlOnlyProvider } from "./url-only-provider-factory";

export const findMyHomeProvider = createUrlOnlyProvider({
  name: "FindMyHome",
  domains: ["findmyhome.at", "www.findmyhome.at"],
  sourceListingIdPattern: /\/immobilien\/(?:.*?)-(\d+)(?:[/?#]|$)/,
  listingUrlPattern:
    /https?:\/\/(?:www\.)?findmyhome\.at\/[^\s"<>]+-\d+[^\s"<>]*/i,
  buildSearchUrls: () => [
    {
      label: "FindMyHome — Wohnungen mieten in Wien",
      url: "https://www.findmyhome.at/mietwohnungen/wien",
      description:
        "Open this, then apply district/price/room filters and save the search.",
    },
  ],
  setupInstructions: [
    {
      step: 1,
      title: "Open FindMyHome rentals for Vienna",
      description: "Go to findmyhome.at → Mieten → Wien.",
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
