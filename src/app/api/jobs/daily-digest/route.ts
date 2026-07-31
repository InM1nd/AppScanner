import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/current-user";
import { sendDailyDigest } from "@/server/notifications";

// Manual "run now" trigger so the digest works without the Inngest Dev
// Server/Cloud running locally.
export async function POST() {
  if (process.env.NODE_ENV === "production")
    return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const result = await sendDailyDigest(user.id);
  return NextResponse.json(result);
}
