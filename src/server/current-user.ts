import { currentUser as currentClerkUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { defaultScoringWeights } from "@/types/search-profile";

function clerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  );
}

async function getOrCreateUser(email: string, name?: string | null) {
  return db.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: {
      email,
      name,
      searchProfiles: {
        create: { name: "Default", scoringWeights: defaultScoringWeights },
      },
    },
  });
}

export async function getOwnerUser() {
  const email = (process.env.OWNER_EMAIL ?? process.env.APP_USER_EMAIL)
    ?.trim()
    .toLowerCase();
  if (!email) throw new Error("OWNER_EMAIL is required.");
  return getOrCreateUser(email);
}

export async function getCurrentUser() {
  if (!clerkConfigured()) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Clerk is required in production.");
    return getOwnerUser();
  }

  const clerkUser = await currentClerkUser();
  if (!clerkUser) redirect("/sign-in");
  const email = clerkUser.primaryEmailAddress?.emailAddress
    .trim()
    .toLowerCase();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !ownerEmail || email !== ownerEmail)
    redirect("/sign-in?error=owner_only");
  return getOrCreateUser(email, clerkUser.fullName);
}

export async function getActiveSearchProfile(userId: string) {
  const existing = await db.searchProfile.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return db.searchProfile.create({ data: { userId, name: "Default" } });
}
