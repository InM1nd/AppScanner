// Seeds fictional (clearly fake) Vienna listings through the real app
// pipeline (createListingFromDraft -> validation, duplicate detection,
// cost + score computation) so the seeded data behaves exactly like a real
// import, not a hand-crafted shortcut.

import "dotenv/config";
import { db } from "../src/lib/db";
import { getCurrentUser } from "../src/server/current-user";
import { createListingFromDraft } from "../src/server/listings";
import { calculateCommuteForListing } from "../src/server/commute";
import {
  blankNormalizedListing,
  exactFact,
  estimateFact,
  unknownFact,
} from "../src/types/listing";
import type { NormalizedListing } from "../src/types/listing";
import type { ProviderName } from "../src/types/enums";

const PROVIDERS: { name: ProviderName; displayName: string }[] = [
  { name: "WILLHABEN", displayName: "Willhaben" },
  { name: "IMMOSCOUT24_AT", displayName: "ImmoScout24 Austria" },
  { name: "IMMOWELT_AT", displayName: "ImmoWelt Austria" },
  { name: "DER_STANDARD", displayName: "Der Standard Immobilien" },
  { name: "FINDMYHOME", displayName: "FindMyHome" },
  { name: "GENERIC_URL", displayName: "Generic URL importer" },
  { name: "MANUAL", displayName: "Manual entry" },
];

function draft(overrides: Partial<NormalizedListing>): NormalizedListing {
  return { ...blankNormalizedListing, ...overrides };
}

async function main() {
  console.log("Seeding providers...");
  for (const p of PROVIDERS) {
    await db.provider.upsert({
      where: { name: p.name },
      update: {},
      create: { name: p.name, displayName: p.displayName },
    });
  }

  console.log("Seeding user + default search profile...");
  const user = await getCurrentUser();

  const willhaben = await db.provider.findUniqueOrThrow({
    where: { name: "WILLHABEN" },
  });
  await db.savedSearch.deleteMany({ where: { providerId: willhaben.id } });
  await db.savedSearch.create({
    data: {
      providerId: willhaben.id,
      label: "Willhaben — 14/15/16, 2 Zimmer, bis €1100",
      searchUrl: "https://www.willhaben.at/iad/immobilien/mietwohnungen/wien",
      emailAlertInstructions:
        "Save this search on willhaben.at and enable email alerts.",
    },
  });

  console.log(
    "Seeding fictional listings (all data below is invented for demo purposes)...",
  );

  const listings: {
    providerName: ProviderName;
    draft: NormalizedListing;
    commuteCoords?: { lat: number; lng: number };
  }[] = [
    {
      providerName: "WILLHABEN",
      commuteCoords: { lat: 48.1955, lng: 16.3305 },
      draft: draft({
        title: "Sonnige 2-Zimmer-Wohnung nahe U3 Schweglerstraße [DEMO]",
        canonicalUrl:
          "https://www.willhaben.at/iad/immobilien/d/mietwohnung/wien/wien-1150-rudolfsheim-fuenfhaus/demo-fixture-1000001/",
        sourceListingId: "1000001",
        importMethod: "URL_METADATA",
        listingType: "RENTAL",
        city: "Wien",
        address: "Hütteldorfer Straße 52, 1150 Wien",
        postalCode: "1150",
        district: 15,
        latitude: 48.1955,
        longitude: 16.3305,
        rooms: 2,
        squareMeters: 58,
        hasSeparateBedroom: "YES",
        furnishedLevel: "UNFURNISHED",
        baseRent: exactFact(720, "Listed base rent"),
        operatingCosts: exactFact(140, "Betriebskosten laut Exposé"),
        heatingCost: exactFact(60, "Heizkosten laut Exposé"),
        hotWaterCost: exactFact(30, "Warmwasser laut Exposé"),
        electricityEstimate: estimateFact(
          70,
          "Not billed by landlord — market estimate",
        ),
        internetEstimate: estimateFact(35, "Market estimate"),
        parkingMonthlyCost: exactFact(0, "No dedicated parking"),
        deposit: exactFact(2160, "3 Monatsmieten"),
        commission: unknownFact,
        contractFee: unknownFact,
        availabilityDate: new Date("2026-09-20"),
        contractType: "UNLIMITED",
        kitchen: "FITTED",
        washingMachine: "MACHINE_INCLUDED",
        parkingAvailability: "NONE",
        elevator: "YES",
        balcony: "YES",
        airConditioning: "NO",
        storage: "YES",
        quietCourtyardSignal: "YES",
        newerOrRenovatedSignal: "YES",
        heatingType: "DISTRICT",
        energyRating: "B",
        description:
          "[DEMO/FICTIONAL] Renovierte 2-Zimmer-Wohnung mit Einbauküche, Balkon zum ruhigen Innenhof und Kellerabteil. Fußläufig zur U3 Schweglerstraße.",
        photos: [],
        contactMethod: "hausverwaltung-demo@example.com",
      }),
    },
    {
      providerName: "IMMOSCOUT24_AT",
      commuteCoords: { lat: 48.1998, lng: 16.3275 },
      draft: draft({
        title: "Helle Wohnung mit Loggia, Penzing [DEMO]",
        canonicalUrl:
          "https://www.immobilienscout24.at/expose/1000002-demo-fixture",
        sourceListingId: "1000002",
        importMethod: "URL_METADATA",
        listingType: "RENTAL",
        address: "Linzer Straße 210, 1140 Wien",
        postalCode: "1140",
        district: 14,
        latitude: 48.1998,
        longitude: 16.3275,
        rooms: 2,
        squareMeters: 62,
        hasSeparateBedroom: "YES",
        furnishedLevel: "UNFURNISHED",
        baseRent: exactFact(830, "Listed base rent"),
        operatingCosts: exactFact(160, "Betriebskosten"),
        heatingCost: estimateFact(65, "Estimated from building type"),
        hotWaterCost: estimateFact(25, "Estimated"),
        electricityEstimate: estimateFact(75, "Market estimate"),
        internetEstimate: estimateFact(35, "Market estimate"),
        parkingMonthlyCost: exactFact(
          60,
          "Garage space available at extra cost",
        ),
        deposit: exactFact(2490, "3 Monatsmieten"),
        commission: exactFact(
          996,
          "2 Monatsmieten + USt (Vermittlungsprovision)",
        ),
        contractFee: unknownFact,
        availabilityDate: new Date("2026-09-25"),
        contractType: "UNLIMITED",
        kitchen: "FITTED",
        washingMachine: "CONNECTION_ONLY",
        parkingAvailability: "AVAILABLE_EXTRA_COST",
        elevator: "YES",
        balcony: "YES",
        airConditioning: "NO",
        storage: "UNKNOWN",
        quietCourtyardSignal: "UNKNOWN",
        newerOrRenovatedSignal: "NO",
        heatingType: "GAS",
        energyRating: "C",
        description:
          "[DEMO/FICTIONAL] 2-Zimmer-Wohnung mit Loggia, Garage optional dazumietbar.",
        photos: [],
        contactMethod: "immoscout-demo-agent@example.com",
      }),
    },
    {
      providerName: "IMMOWELT_AT",
      draft: draft({
        title: "Wohnung mit unklaren Heizkosten, Ottakring [DEMO]",
        canonicalUrl: "https://www.immowelt.at/expose/demo-fixture-1000003",
        sourceListingId: "1000003",
        importMethod: "URL_METADATA",
        listingType: "RENTAL",
        address: "Thaliastraße 80, 1160 Wien",
        postalCode: "1160",
        district: 16,
        rooms: 2,
        squareMeters: 55,
        hasSeparateBedroom: "YES",
        baseRent: exactFact(750),
        operatingCosts: exactFact(130),
        heatingCost: unknownFact,
        hotWaterCost: unknownFact,
        electricityEstimate: unknownFact,
        internetEstimate: unknownFact,
        parkingMonthlyCost: unknownFact,
        deposit: exactFact(2640),
        commission: unknownFact,
        contractFee: unknownFact,
        availabilityDate: null,
        contractType: "UNKNOWN",
        kitchen: "BASIC",
        washingMachine: "UNKNOWN",
        parkingAvailability: "UNKNOWN",
        elevator: "UNKNOWN",
        balcony: "UNKNOWN",
        airConditioning: "UNKNOWN",
        storage: "UNKNOWN",
        quietCourtyardSignal: "UNKNOWN",
        newerOrRenovatedSignal: "UNKNOWN",
        heatingType: "UNKNOWN",
        description:
          "[DEMO/FICTIONAL] Wohnung, viele Details im Exposé nicht angegeben.",
        photos: [],
        contactMethod: null,
      }),
    },
    {
      providerName: "DER_STANDARD",
      commuteCoords: { lat: 48.198, lng: 16.3555 },
      draft: draft({
        title: "Premium-Wohnung mit hohen Nebenkosten, Neubau [DEMO]",
        canonicalUrl:
          "https://immobilien.derstandard.at/wohnung/demo-fixture-1000004",
        sourceListingId: "1000004",
        importMethod: "URL_METADATA",
        listingType: "RENTAL",
        address: "Neubaugasse 30, 1070 Wien",
        postalCode: "1070",
        district: 7,
        latitude: 48.198,
        longitude: 16.3555,
        rooms: 2,
        squareMeters: 70,
        hasSeparateBedroom: "YES",
        baseRent: exactFact(950),
        operatingCosts: exactFact(220),
        heatingCost: exactFact(90),
        hotWaterCost: exactFact(40),
        electricityEstimate: estimateFact(85),
        internetEstimate: estimateFact(35),
        parkingMonthlyCost: unknownFact,
        deposit: exactFact(
          3800,
          "4 Monatsmieten — above the usual 3-month norm",
        ),
        commission: exactFact(1140, "Vermittlungsprovision"),
        contractFee: exactFact(150, "Vertragserrichtungsgebühr"),
        availabilityDate: new Date("2026-10-01"),
        contractType: "UNLIMITED",
        kitchen: "FITTED",
        washingMachine: "MACHINE_INCLUDED",
        parkingAvailability: "NONE",
        elevator: "YES",
        balcony: "NO",
        airConditioning: "YES",
        storage: "NO",
        quietCourtyardSignal: "NO",
        newerOrRenovatedSignal: "YES",
        heatingType: "DISTRICT",
        energyRating: "A",
        description:
          "[DEMO/FICTIONAL] Hochwertige Ausstattung, aber Provision, Vertragsgebühr und hohe Kaution.",
        photos: [],
        contactMethod: "derstandard-demo@example.com",
      }),
    },
    {
      providerName: "FINDMYHOME",
      draft: draft({
        title: "WG-Zimmer im 7. Bezirk [DEMO — sollte ausgeschlossen werden]",
        canonicalUrl:
          "https://www.findmyhome.at/wg-zimmer-demo-fixture-1000005",
        sourceListingId: "1000005",
        importMethod: "URL_METADATA",
        listingType: "SHARED_ROOM",
        address: "Kaiserstraße 10, 1070 Wien",
        postalCode: "1070",
        district: 7,
        rooms: 1,
        squareMeters: 16,
        hasSeparateBedroom: "NO",
        baseRent: exactFact(450),
        operatingCosts: exactFact(60),
        heatingCost: exactFact(20),
        hotWaterCost: exactFact(10),
        electricityEstimate: unknownFact,
        internetEstimate: unknownFact,
        parkingMonthlyCost: unknownFact,
        deposit: exactFact(900),
        commission: unknownFact,
        contractFee: unknownFact,
        availabilityDate: new Date("2026-09-15"),
        contractType: "UNLIMITED",
        kitchen: "BASIC",
        washingMachine: "MACHINE_INCLUDED",
        parkingAvailability: "NONE",
        elevator: "NO",
        balcony: "NO",
        airConditioning: "NO",
        storage: "NO",
        quietCourtyardSignal: "UNKNOWN",
        newerOrRenovatedSignal: "NO",
        heatingType: "GAS",
        description:
          "[DEMO/FICTIONAL] Zimmer in 3er-WG — demonstrates the WG/shared-room zero-score rule.",
        photos: [],
        contactMethod: "wg-demo@example.com",
      }),
    },
    {
      providerName: "GENERIC_URL",
      draft: draft({
        title:
          "Befristete Zwischenmiete, Mariahilf [DEMO — sollte ausgeschlossen werden]",
        canonicalUrl:
          "https://example-listings.at/zwischenmiete-demo-fixture-1000006",
        sourceListingId: "1000006",
        importMethod: "URL_METADATA",
        listingType: "RENTAL",
        address: "Mariahilfer Straße 45, 1060 Wien",
        postalCode: "1060",
        district: 6,
        rooms: 2,
        squareMeters: 50,
        hasSeparateBedroom: "YES",
        baseRent: exactFact(900),
        operatingCosts: exactFact(100),
        heatingCost: exactFact(40),
        hotWaterCost: exactFact(20),
        electricityEstimate: estimateFact(70),
        internetEstimate: estimateFact(30),
        parkingMonthlyCost: unknownFact,
        deposit: exactFact(1800),
        commission: unknownFact,
        contractFee: unknownFact,
        availabilityDate: new Date("2026-09-15"),
        contractType: "TEMPORARY",
        kitchen: "FITTED",
        washingMachine: "MACHINE_INCLUDED",
        parkingAvailability: "NONE",
        elevator: "YES",
        balcony: "NO",
        airConditioning: "NO",
        storage: "UNKNOWN",
        quietCourtyardSignal: "UNKNOWN",
        newerOrRenovatedSignal: "UNKNOWN",
        heatingType: "DISTRICT",
        description:
          "[DEMO/FICTIONAL] 6-month sublet only — demonstrates the short-term-sublet zero-score rule.",
        photos: [],
        contactMethod: "sublet-demo@example.com",
      }),
    },
    {
      providerName: "MANUAL",
      draft: draft({
        title: "Studio ohne separates Schlafzimmer, Favoriten [DEMO]",
        canonicalUrl: "https://example-listings.at/studio-demo-fixture-1000007",
        sourceListingId: "1000007",
        importMethod: "MANUAL",
        listingType: "RENTAL",
        address: "Favoritenstraße 120, 1100 Wien",
        postalCode: "1100",
        district: 10,
        rooms: 1,
        squareMeters: 38,
        hasSeparateBedroom: "NO",
        baseRent: exactFact(680),
        operatingCosts: exactFact(90),
        heatingCost: exactFact(35),
        hotWaterCost: exactFact(15),
        electricityEstimate: estimateFact(55),
        internetEstimate: estimateFact(30),
        parkingMonthlyCost: unknownFact,
        deposit: exactFact(1360),
        commission: unknownFact,
        contractFee: unknownFact,
        availabilityDate: new Date("2026-09-18"),
        contractType: "UNLIMITED",
        kitchen: "FITTED",
        washingMachine: "MACHINE_INCLUDED",
        parkingAvailability: "NONE",
        elevator: "NO",
        balcony: "NO",
        airConditioning: "NO",
        storage: "NO",
        quietCourtyardSignal: "UNKNOWN",
        newerOrRenovatedSignal: "NO",
        heatingType: "GAS",
        description:
          "[DEMO/FICTIONAL] Studio-Wohnung ohne separates Schlafzimmer — demonstrates the studio penalty.",
        photos: [],
        contactMethod: null,
      }),
    },
  ];

  for (const item of listings) {
    try {
      const created = await createListingFromDraft({
        providerName: item.providerName,
        draft: item.draft,
      });
      if (item.commuteCoords) {
        await calculateCommuteForListing(created.id, user.id);
      }
      console.log(`  + ${created.title}`);
    } catch (error) {
      console.warn(
        `  ! skipped (${error instanceof Error ? error.message : error})`,
      );
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
