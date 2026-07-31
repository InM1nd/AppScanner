import { NextResponse } from "next/server";
import { recomputeAllListings } from "@/server/recompute";
import { getCurrentUser } from "@/server/current-user";

// Manual "run now" trigger for a full rescore — same job Settings' "recalculate
// all scores" button calls, exposed here so it can run without a UI too.
export async function POST() {
  if (process.env.NODE_ENV === "production")
    return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const count = await recomputeAllListings(user.id);
  return NextResponse.json({ recalculated: count });
}
