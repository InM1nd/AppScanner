import { listAllListings } from "@/server/queries";
import { toListingCardVM } from "@/server/view-models";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/server";
import { ListingsExplorer } from "@/components/listings/listings-explorer";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const { dict } = await getDictionary();
  const listings = (await listAllListings()).map(toListingCardVM);
  const providers = await db.provider.findMany({
    orderBy: { displayName: "asc" },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.listings.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {listings.length} {dict.listings.tracked}
        </p>
      </div>
      <ListingsExplorer
        listings={listings}
        providers={providers.map((p) => ({ id: p.id, name: p.displayName }))}
      />
    </div>
  );
}
