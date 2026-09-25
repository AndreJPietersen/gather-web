"use server";

import { callerFromCookies } from "@/server/context";
import { checkAndSendPaymentReminders as sendPayments, checkAndSendTaskReminders as sendTasks } from "@/server/services/reminders";

// Thin Server Action wrappers: the logic (and its long explanation) lives in
// src/server/services/reminders.ts, shared with the native apps' API.
export async function checkAndSendPaymentReminders(): Promise<void> {
  const caller = await callerFromCookies();
  if (caller) await sendPayments(caller);
}

export async function checkAndSendTaskReminders(): Promise<void> {
  const caller = await callerFromCookies();
  if (caller) await sendTasks(caller);
}
