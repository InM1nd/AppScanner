import { listAllListings } from "@/server/queries";
import { toListingCardVM } from "@/server/view-models";
import { CompareExplorer } from "@/components/compare/compare-explorer";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const { dict } = await getDictionary();
  const listings = (await listAllListings()).map(toListingCardVM);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.compare.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dict.compare.subtitle}
        </p>
      </div>
      <CompareExplorer listings={listings} />
    </div>
  );
}
