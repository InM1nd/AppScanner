// Duplicate detection. Pure function, no DB — callers pass in the candidate
// and the pool of existing listings to compare against (e.g. same district).

export interface DuplicateCandidate {
  id: string;
  providerId: string;
  sourceListingId: string | null;
  canonicalUrl: string;
  address: string | null;
  district: number | null;
  rooms: number | null;
  squareMeters: number | null;
  baseRentAmount: number | null;
  advertisedMonthlyTotalAmount: number | null;
}

export type DuplicateMatchReason =
  "SAME_URL" | "SAME_PROVIDER_SOURCE_ID" | "SIMILAR_ADDRESS_AND_PRICE";

export interface DuplicateMatch {
  matchedListingId: string;
  reason: DuplicateMatchReason;
  confidence: number; // 0..1
  evidence: string[];
}

export function normalizeCanonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.port = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key))
        url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeAddress(address: string | null): string {
  if (!address) return "";
  return address
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/straße|strasse|str\./g, "str")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenJaccard(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function withinTolerance(
  a: number,
  b: number,
  relativeTolerance: number,
): boolean {
  const denominator = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denominator <= relativeTolerance;
}

const ADDRESS_SIMILARITY_THRESHOLD = 0.6;

function comparablePrice(
  left: DuplicateCandidate,
  right: DuplicateCandidate,
): readonly [string, number, number] | null {
  if (left.baseRentAmount !== null && right.baseRentAmount !== null) {
    return ["base rent", left.baseRentAmount, right.baseRentAmount];
  }
  if (
    left.advertisedMonthlyTotalAmount !== null &&
    right.advertisedMonthlyTotalAmount !== null
  ) {
    return [
      "advertised total",
      left.advertisedMonthlyTotalAmount,
      right.advertisedMonthlyTotalAmount,
    ];
  }
  return null;
}

function betterMatch(
  current: DuplicateMatch | null,
  next: DuplicateMatch,
): DuplicateMatch {
  if (!current) return next;
  const priority: Record<DuplicateMatchReason, number> = {
    SAME_PROVIDER_SOURCE_ID: 3,
    SAME_URL: 2,
    SIMILAR_ADDRESS_AND_PRICE: 1,
  };
  if (next.confidence !== current.confidence)
    return next.confidence > current.confidence ? next : current;
  if (priority[next.reason] !== priority[current.reason])
    return priority[next.reason] > priority[current.reason] ? next : current;
  return next.matchedListingId.localeCompare(current.matchedListingId) < 0
    ? next
    : current;
}

export function findDuplicateMatch(
  candidate: DuplicateCandidate,
  existing: DuplicateCandidate[],
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  const candidateUrl = normalizeCanonicalUrl(candidate.canonicalUrl);

  for (const other of existing) {
    if (other.id === candidate.id) continue;

    if (
      candidate.sourceListingId &&
      other.sourceListingId &&
      candidate.providerId === other.providerId &&
      candidate.sourceListingId === other.sourceListingId
    ) {
      best = betterMatch(best, {
        matchedListingId: other.id,
        reason: "SAME_PROVIDER_SOURCE_ID",
        confidence: 1,
        evidence: ["same provider and source listing id"],
      });
      continue;
    }

    if (
      candidateUrl &&
      candidateUrl === normalizeCanonicalUrl(other.canonicalUrl)
    ) {
      best = betterMatch(best, {
        matchedListingId: other.id,
        reason: "SAME_URL",
        confidence: 1,
        evidence: ["same normalized canonical URL"],
      });
    }
  }
  if (best?.confidence === 1) return best;

  for (const other of existing) {
    if (other.id === candidate.id || !candidate.address || !other.address)
      continue;
    if (
      candidate.district !== null &&
      other.district !== null &&
      candidate.district !== other.district
    )
      continue;

    const addressSimilarity = tokenJaccard(
      normalizeAddress(candidate.address),
      normalizeAddress(other.address),
    );
    if (addressSimilarity < ADDRESS_SIMILARITY_THRESHOLD) continue;

    const price = comparablePrice(candidate, other);
    const comparable: (readonly [
      string,
      number | null,
      number | null,
      number,
    ])[] = [
      ["rooms", candidate.rooms, other.rooms, 0.15],
      ...(price ? [[price[0], price[1], price[2], 0.08] as const] : []),
      ["area", candidate.squareMeters, other.squareMeters, 0.08],
    ];
    const available = comparable.filter(
      ([, left, right]) => left !== null && right !== null,
    );
    if (
      available.length < 2 ||
      available.some(
        ([, left, right, tolerance]) =>
          !withinTolerance(left!, right!, tolerance),
      )
    ) {
      continue;
    }

    const evidence = [
      `address similarity ${round2(addressSimilarity)}`,
      ...available.map(([name]) => `${name} within tolerance`),
    ];
    best = betterMatch(best, {
      matchedListingId: other.id,
      reason: "SIMILAR_ADDRESS_AND_PRICE",
      confidence: round2(addressSimilarity * 0.65 + 0.35),
      evidence,
    });
  }

  return best;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
