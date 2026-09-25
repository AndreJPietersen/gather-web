import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { getOwnedBusinesses } from "@/lib/owned-businesses";
import { getMaxOwnedBusinesses } from "@/lib/app-settings";
import { PersonaChoices } from "./persona-choices";

// Shown straight after logging in when the account has more than one
// persona (planner plus at least one vendor team), so the first screen is
// the one they actually meant to open. Anyone with a single persona is sent
// on to Home — signIn only routes here when there's a choice to make, and
// this guard covers someone opening the URL directly.
export default async function ChoosePersonaPage() {
  const session = await getSessionContext();
  if (session.status === "guest") redirect("/login");
  if (session.personas.length <= 1) redirect("/");

  const [owned, maxOwned] = await Promise.all([getOwnedBusinesses(session.userId), getMaxOwnedBusinesses()]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Who are you today?</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">You can switch any time from your Profile.</p>
      </div>

      <PersonaChoices personas={session.personas} displayName={session.displayName} />

      <Link href="/onboarding/vendor" className="text-center text-xs font-extrabold text-primary">
        + Add another business
        {owned.length >= maxOwned && " (needs approval)"}
      </Link>
    </main>
  );
}
