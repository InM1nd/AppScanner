"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/sign-in")) return <main>{children}</main>;

  return (
    <>
      <SidebarNav />
      <div className="md:pl-56 flex min-h-full flex-col">
        <MobileNav />
        <main className="flex-1">{children}</main>
      </div>
    </>
  );
}
