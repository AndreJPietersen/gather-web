import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { isSuppressed } from "@/lib/email/suppressions";
import { setAnnouncementSubscription } from "./actions";

// Where the "Unsubscribe from Gather announcements" link in an email lands.
// Only announcements are affected — reminders and direct messages about the
// person's own account still arrive (those are managed from Profile).
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { e, t } = await searchParams;
  const email = typeof e === "string" ? e : "";
  const token = typeof t === "string" ? t : "";
  const valid = !!email && verifyUnsubscribeToken(email, token);

  if (!valid) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-ink">This link doesn&apos;t work</h1>
        <Card>
          <p className="text-sm font-semibold text-text-muted">
            The unsubscribe link is incomplete or has been changed. Use the link from the email itself, or turn off Gather
            news on your Profile if you have an account.
          </p>
        </Card>
      </main>
    );
  }

  const unsubscribed = await isSuppressed(email);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink">{unsubscribed ? "You're unsubscribed" : "Gather announcements"}</h1>
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">
          {unsubscribed ? (
            <>
              <strong>{email}</strong> won&apos;t get Gather news and announcements any more. Reminders about your own events
              and messages about your account still arrive.
            </>
          ) : (
            <>
              Stop sending Gather news and announcements to <strong>{email}</strong>?
            </>
          )}
        </p>
        <form action={setAnnouncementSubscription}>
          <input type="hidden" name="e" value={email} />
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="subscribe" value={unsubscribed ? "true" : "false"} />
          <Button type="submit" variant={unsubscribed ? "secondary" : "primary"} className="w-full">
            {unsubscribed ? "Subscribe again" : "Unsubscribe"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
