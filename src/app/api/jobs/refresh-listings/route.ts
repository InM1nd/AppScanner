import { NextResponse } from "next/server";
import { refreshExistingListings } from "@/server/refresh";
import { getCurrentUser } from "@/server/current-user";

// Manual "run now" trigger — re-fetches every real-fetch-provider listing,
// removes reserved/gone ones, updates the rest.
export async function POST() {
  if (process.env.NODE_ENV === "production")
    return new NextResponse(null, { status: 404 });
  await getCurrentUser();
  const result = await refreshExistingListings();
  return NextResponse.json(result);
}
