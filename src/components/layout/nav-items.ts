import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Bookmark,
  PlusSquare,
  Columns3,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: "nav.groupWorkspace",
    items: [
      { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
      { href: "/listings", key: "nav.listings", icon: Building2 },
      { href: "/saved", key: "nav.saved", icon: Bookmark },
      { href: "/compare", key: "nav.compare", icon: Columns3 },
    ],
  },
  {
    key: "nav.groupManage",
    items: [
      { href: "/import", key: "nav.import", icon: PlusSquare },
      { href: "/settings", key: "nav.settings", icon: Settings },
    ],
  },
];

export function isNavItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
