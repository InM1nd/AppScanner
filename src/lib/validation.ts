// Listing validation: schema correctness (Zod) plus business-rule warnings
// for the "reject or heavily penalize" cases from the search brief (no
// kitchen, unclear costs, obvious scam signals). Pure function, no DB.

import { normalizedListing, type NormalizedListing } from "@/types/listing";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Below this, a 2-room Vienna apartment is priced well outside any real
// market range and is treated as a scam signal rather than a bargain.
const IMPLAUSIBLY_LOW_RENT_EUR = 250;

export function validateListingDraft(draft: unknown): ValidationResult {
  const parsed = normalizedListing.safeParse(draft);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
      warnings: [],
    };
  }

  const listing = parsed.data;
  const warnings: string[] = [];

  if (listing.kitchen === "NONE") {
    warnings.push("No kitchen — hard requirement not met.");
  }
  if (listing.listingType === "SHARED_ROOM") {
    warnings.push("This looks like a shared room (WG), not a full apartment.");
  }
  if (listing.listingType === "SALE") {
    warnings.push("This looks like a purchase/sale listing, not a rental.");
  }
  if (listing.contractType === "TEMPORARY") {
    warnings.push("This looks like a temporary sublet.");
  }
  if (
    listing.baseRent.confidence === "UNKNOWN" &&
    listing.operatingCosts.confidence === "UNKNOWN"
  ) {
    warnings.push("Mandatory costs are entirely unclear — treat with caution.");
  }
  if (
    listing.baseRent.amount !== null &&
    listing.rooms !== null &&
    listing.rooms >= 2 &&
    listing.baseRent.amount < IMPLAUSIBLY_LOW_RENT_EUR
  ) {
    warnings.push(
      `Rent (€${listing.baseRent.amount}) is implausibly low for ${listing.rooms} rooms — possible scam.`,
    );
  }
  if (listing.photos.length === 0) {
    warnings.push("No photos provided.");
  }
  if (!listing.contactMethod) {
    warnings.push("No contact method provided.");
  }
  if (listing.description && listing.description.trim().length < 20) {
    warnings.push("Description is very short.");
  }

  return { valid: true, errors: [], warnings };
}

export function isNormalizedListing(
  value: unknown,
): value is NormalizedListing {
  return normalizedListing.safeParse(value).success;
}
