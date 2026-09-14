"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePersonaStore } from "@/components/providers/persona-provider";

interface Tab {
  label: string;
  href: string;
}

const GUEST_TABS: Tab[] = [
  { label: "Home", href: "/" },
  { label: "Vendors", href: "/vendors" },
  { label: "Log In", href: "/login" },
];

const PLANNER_TABS: Tab[] = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Vendors", href: "/vendors" },
  { label: "Profile", href: "/profile" },
];

function vendorTabs(vendorId: string): Tab[] {
  return [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: `/vendor/${vendorId}/dashboard` },
    { label: "Vendors", href: "/vendors" },
    { label: "Profile", href: "/profile" },
  ];
}

function TabBarShell({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t-2 border-border bg-surface px-2 pt-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-pill px-4 py-2 text-xs font-extrabold transition-opacity",
              isActive ? "bg-primary-soft text-primary" : "text-text-muted",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function GuestTabBar() {
  return <TabBarShell tabs={GUEST_TABS} />;
}

export function AuthedTabBar() {
  const activePersona = usePersonaStore((state) => state.activePersona);
  const tabs = activePersona.type === "vendor" ? vendorTabs(activePersona.vendorId) : PLANNER_TABS;

  return <TabBarShell tabs={tabs} />;
}
