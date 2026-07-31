import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/current-user";
import { recalculateAllCommutes } from "@/server/commute";

// Manual "run now" trigger — recomputes transit commute (and score) for
// every listing with coordinates, using whatever ROUTING_PROVIDER is
// configured (mock or google).
export async function POST() {
  if (process.env.NODE_ENV === "production")
    return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const result = await recalculateAllCommutes(user.id);
  return NextResponse.json(result);
}
