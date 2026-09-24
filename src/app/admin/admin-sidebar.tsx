"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Store, CalendarDays, LifeBuoy, ListTree, Tags, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Planners", href: "/admin/planners", icon: Users },
  { label: "Vendors", href: "/admin/vendors", icon: Store },
  { label: "Featured", href: "/admin/featured", icon: Star },
  { label: "Events", href: "/admin/events", icon: CalendarDays },
  { label: "Event Types", href: "/admin/event-types", icon: ListTree },
  { label: "Service Categories", href: "/admin/service-categories", icon: Tags },
  { label: "Cases", href: "/admin/cases", icon: LifeBuoy },
];

// A left sidebar, not the consumer app's bottom tab bar — this console is
// desktop-oriented by design (see docs/gather_web_admin_architecture.md's
// "a deliberate exception to mobile-first"). Still the same OKLCH tokens
// and fonts as the rest of the app, just laid out for a wide viewport.
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r-2 border-border bg-surface px-4 py-8">
      <p className="mb-4 px-3 font-display text-lg font-semibold text-ink">Gather Admin</p>
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-field px-3 py-2 text-sm font-bold transition-colors",
              isActive ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-bg",
            )}
          >
            <item.icon size={18} strokeWidth={2.5} />
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
