import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";

const withClerk = clerkMiddleware(async (auth, request) => {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/sign-in") || path.startsWith("/api/inngest")) return;
  await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Clerk is required in production.");
    return NextResponse.next();
  }
  return withClerk(request, event);
}

export const config = {
  matcher: [
    // /api/inngest is excluded here, not just early-returned inside
    // withClerk: Inngest verifies its own request signatures, and every
    // step.run is a separate invocation — running Clerk on all of them is
    // pure Active CPU burn.
    "/((?!_next|api/inngest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/((?!api/inngest)(?:api|trpc))(.*)",
  ],
};
