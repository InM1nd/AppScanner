import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/current-user";

export async function GET(req: NextRequest) {
  await getCurrentUser();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ listings: [] });

  const listings = await db.listing.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true, district: true },
    take: 8,
    orderBy: { importedAt: "desc" },
  });

  return NextResponse.json({ listings });
}
