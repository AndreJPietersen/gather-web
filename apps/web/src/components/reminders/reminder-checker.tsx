"use client";

import { useEffect } from "react";
import { checkAndSendPaymentReminders, checkAndSendTaskReminders } from "./actions";

// Mounted once in AppShell for every authenticated session (src/components/
// app-shell.tsx) — renders nothing. Fires the implicit reminder check once
// per app open (a full browser/tab load, not every client-side navigation,
// since AppShell itself doesn't remount on route changes), the "no cron"
// replacement described on payment_reminders in schema.ts. No setState
// here — this effect exists to trigger a real one-shot side effect on
// mount, not to synchronize render state, so it doesn't trip this project's
// react-hooks/set-state-in-effect rule the way copying a value into local
// state would.
export function ReminderChecker() {
  useEffect(() => {
    checkAndSendPaymentReminders();
    checkAndSendTaskReminders();
  }, []);

  return null;
}
