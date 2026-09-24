"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PersonaProvider } from "@/components/providers/persona-provider";
import { BackgroundPattern } from "@/components/theme/background-pattern";
import { GuestTabBar, AuthedTabBar } from "@/components/nav/tab-bar";
import { ToastContainer } from "@/components/toast/toast-container";
import { ReminderChecker } from "@/components/reminders/reminder-checker";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { ConfirmDialogHost } from "@/components/confirm-dialog-host";
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
        <ConfirmDialogHost />
      </>
    );
  }

  if (session.status === "guest") {
    return (
      <>
        <BackgroundPattern />
        <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
        <GuestTabBar />
        <ToastContainer />
        <UnsavedChangesGuard />
        <ConfirmDialogHost />
      </>
    );
  }

  return (
    <PersonaProvider personas={session.personas}>
      <BackgroundPattern />
      <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))]">{children}</main>
      <AuthedTabBar />
      <ToastContainer />
      <ReminderChecker />
      <UnsavedChangesGuard />
      <ConfirmDialogHost />
    </PersonaProvider>
  );
}
