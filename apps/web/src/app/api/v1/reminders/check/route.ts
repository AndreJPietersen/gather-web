import { authed } from "@/server/api";
import { checkAndSendPaymentReminders, checkAndSendTaskReminders } from "@/server/services/reminders";
import { ok } from "@/server/result";

// POST /api/v1/reminders/check — sends the caller's due payment and task
// reminder emails (each at most once). The website calls the same code once
// per session; the apps will use push notifications instead (L8) and can
// call this until then.
export async function POST(request: Request) {
  return authed(request, async (caller) => {
    await checkAndSendPaymentReminders(caller);
    await checkAndSendTaskReminders(caller);
    return ok();
  });
}
