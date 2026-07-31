import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <SignIn />
    </main>
  );
}
