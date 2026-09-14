"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PersonaProvider } from "@/components/providers/persona-provider";
import { GuestTabBar, AuthedTabBar } from "@/components/nav/tab-bar";
import { ToastContainer } from "@/components/toast/toast-container";
import type { SessionContext } from "@/lib/session";

export function AppShell({ session, children }: { session: SessionContext; children: ReactNode }) {
  const pathname = usePathname();

  // /admin is a deliberate exception to "mobile-first" (see
  // docs/gather_web_admin_architecture.md) — a desktop-oriented console with
  // its own sidebar layout (src/app/admin/layout.tsx), not the consumer
  // bottom-tab-bar shell. It still shares this root layout's fonts/tokens
  // and the toast system, just none of the mobile chrome around it.
  if (pathname?.startsWith("/admin")) {
    return (
      <>
        {children}
        <ToastContainer />
      </>
    );
  }

  if (session.status === "guest") {
    return (
      <>
        <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
        <GuestTabBar />
        <ToastContainer />
      </>
    );
  }

  return (
    <PersonaProvider personas={session.personas}>
      <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
      <AuthedTabBar />
      <ToastContainer />
    </PersonaProvider>
  );
}
