"use client";

import type { ReactNode } from "react";
import { PersonaProvider } from "@/components/providers/persona-provider";
import { GuestTabBar, AuthedTabBar } from "@/components/nav/tab-bar";
import { PersonaSwitcher } from "@/components/nav/persona-switcher";
import { ToastContainer } from "@/components/toast/toast-container";
import type { SessionContext } from "@/lib/session";

export function AppShell({ session, children }: { session: SessionContext; children: ReactNode }) {
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
      {session.personas.length > 1 && <PersonaSwitcher />}
      <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
      <AuthedTabBar />
      <ToastContainer />
    </PersonaProvider>
  );
}
