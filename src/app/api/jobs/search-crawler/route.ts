import { NextResponse } from "next/server";
import { runSearchCrawler } from "@/server/crawler";
import { getCurrentUser } from "@/server/current-user";

// Manual "run now" trigger so the crawler works without the Inngest Dev
// Server/Cloud running locally.
export async function POST() {
  if (process.env.NODE_ENV === "production")
    return new NextResponse(null, { status: 404 });
  await getCurrentUser();
  const result = await runSearchCrawler();
  return NextResponse.json(result);
}
