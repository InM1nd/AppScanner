import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getListingDetail } from "@/server/queries";
import { toListingDetailVM } from "@/server/view-models";
import { getCurrentUser } from "@/server/current-user";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/server";
import { districtLabel, formatDate, enumLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { DecisionStrip } from "@/components/shared/decision-strip";
import { PhotoGallery } from "@/components/listing-detail/photo-gallery";
import { CostBreakdownCard } from "@/components/listing-detail/cost-breakdown-card";
import { CommuteCard } from "@/components/listing-detail/commute-card";
import { ScoreBreakdownCard } from "@/components/listing-detail/score-breakdown-card";
import { StatusActions } from "@/components/listing-detail/status-actions";
import { ContactTemplate } from "@/components/listing-detail/contact-template";
import { ViewingChecklist } from "@/components/listing-detail/viewing-checklist";
import { NotesSection } from "@/components/listing-detail/notes-section";
import { TimelineSection } from "@/components/listing-detail/timeline-section";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raw = await getListingDetail(id);
  if (!raw) notFound();
  const listing = toListingDetailVM(raw);
  const { dict } = await getDictionary();
  const ld = dict.listingDetail;
  const c = dict.common;

  const TRI_LABEL: Record<string, string> = {
    YES: c.yes,
    NO: c.no,
    UNKNOWN: ld.unconfirmed,
  };

  const user = await getCurrentUser();
  const watching = await db.watchlistItem.findUnique({
    where: { userId_listingId: { userId: user.id, listingId: id } },
  });

  const amenities: [string, string][] = [
    [ld.kitchen, enumLabel(listing.kitchen)],
    [ld.washingMachine, enumLabel(listing.washingMachine)],
    [ld.parking, enumLabel(listing.parkingAvailability)],
    [ld.elevator, TRI_LABEL[listing.elevator]],
    [ld.balcony, TRI_LABEL[listing.balcony]],
    [ld.airConditioning, TRI_LABEL[listing.airConditioning]],
    [ld.storage, TRI_LABEL[listing.storage]],
    [ld.quietCourtyard, TRI_LABEL[listing.quietCourtyardSignal]],
    [ld.newerRenovated, TRI_LABEL[listing.newerOrRenovatedSignal]],
    [ld.heating, enumLabel(listing.heatingType)],
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <Link
        href="/listings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {c.backToListings}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {listing.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {districtLabel(listing.district)} · {listing.address ?? c.unknown} ·
            via {listing.provider.displayName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={listing.status} />
          <a
            href={listing.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {c.openSource} <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <StatusActions
        listingId={listing.id}
        currentStatus={listing.status}
        isWatching={Boolean(watching)}
      />

      <DecisionStrip listing={listing} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PhotoGallery photos={listing.photos} title={listing.title} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ld.details}</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Row
                label={ld.rooms}
                value={listing.rooms ? String(listing.rooms) : c.unknown}
              />
              <Row
                label={ld.size}
                value={
                  listing.squareMeters
                    ? `${listing.squareMeters} m²`
                    : c.unknown
                }
              />
              <Row
                label={ld.separateBedroom}
                value={TRI_LABEL[listing.hasSeparateBedroom]}
              />
              <Row
                label={ld.furnished}
                value={enumLabel(listing.furnishedLevel)}
              />
              <Row
                label={ld.contractType}
                value={enumLabel(listing.contractType)}
              />
              <Row
                label={ld.availability}
                value={formatDate(listing.availabilityDate)}
              />
              <Row
                label={ld.importMethod}
                value={enumLabel(listing.importMethod)}
              />
              <Row
                label={ld.energyRating}
                value={listing.energyRating ?? c.unknown}
              />
              {amenities.map(([label, value]) => (
                <Row key={label} label={label} value={value} />
              ))}
            </CardContent>
          </Card>

          {listing.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{ld.description}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {listing.description}
                </p>
              </CardContent>
            </Card>
          )}

          <CostBreakdownCard
            listing={listing}
            title={ld.financials}
            knownMonthlyLabel={ld.knownMonthly}
            likelyMonthlyLabel={ld.likelyMonthly}
            upfrontCostLabel={ld.upfrontCost}
          />
          <NotesSection listingId={listing.id} notes={listing.notes} />
          <TimelineSection
            snapshots={listing.snapshots}
            title={ld.timeline}
            fieldLabels={ld.timelineFields}
            unknownLabel={c.unknown}
          />
        </div>

        <div className="space-y-6">
          <ScoreBreakdownCard
            totalScore={listing.scoreBreakdown?.totalScore ?? 0}
            dataCompleteness={listing.scoreBreakdown?.dataCompleteness ?? 0}
            isZeroed={listing.scoreBreakdown?.isZeroed ?? false}
            zeroReason={listing.scoreBreakdown?.zeroReason ?? null}
            categories={listing.scoreBreakdown?.categories ?? []}
            title={ld.scoreBreakdown}
            notCalculatedLabel={ld.notCalculated}
          />
          <CommuteCard
            listingId={listing.id}
            hasCoordinates={
              listing.latitude !== null && listing.longitude !== null
            }
            estimates={listing.commuteEstimates}
          />
          <ContactTemplate
            title={listing.title}
            rooms={listing.rooms}
            squareMeters={listing.squareMeters}
          />
          <ViewingChecklist />
          {listing.rejectionReason && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {ld.rejectionReason}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="destructive">{listing.rejectionReason}</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
