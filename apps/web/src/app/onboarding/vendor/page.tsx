import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getOpenBusinessRequests, getOwnedBusinesses } from "@/lib/owned-businesses";
import { getMaxOwnedBusinesses } from "@/lib/app-settings";
import { VendorOnboardingForm } from "./onboarding-form";

// Both first-time vendor registration and "add another business" — the same
// form, with the owner limits (admin-set maximum, one per category) shown up front so
// nobody fills it in only to be told no at the end.
export default async function VendorOnboardingPage({ searchParams }: PageProps<"/onboarding/vendor">) {
  const session = await getSessionContext();
  if (session.status === "guest") {
    redirect("/login");
  }
  const { requested } = await searchParams;

  const supabase = await createClient();
  const [owned, openRequests, { data: categoryRows }, maxOwned] = await Promise.all([
    getOwnedBusinesses(session.userId),
    getOpenBusinessRequests(session.userId),
    supabase.from("service_categories").select("name").eq("is_active", true).order("name"),
    getMaxOwnedBusinesses(),
  ]);
  const pendingRequest = openRequests.find((r) => r.status === "pending");
  const approved = openRequests.filter((r) => r.status === "approved");

  if (requested === "1" && pendingRequest) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-3 px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Request sent</h1>
        <p className="text-sm font-semibold text-text-muted">
          An admin will review your request for {pendingRequest.business_name}. Once it&apos;s approved, come back here
          and create it as normal.
        </p>
        <LinkButton href="/profile" variant="accent" className="mt-4 w-full">
          Back to profile
        </LinkButton>
      </main>
    );
  }

  const isFirst = owned.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{isFirst ? "Set up your business" : "Add another business"}</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">
          You&apos;ll be the Owner — add teammates later.
          {!isFirst && ` You own ${owned.length} of ${maxOwned} businesses, one per category.`}
        </p>
      </div>

      {!isFirst && (
        <p className="text-xs font-semibold text-text-muted">
          Already own: {owned.map((b) => `${b.name}${b.primaryCategory ? ` (${b.primaryCategory})` : ""}`).join(", ")}
        </p>
      )}

      {pendingRequest && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-extrabold text-ink">Request waiting for review</p>
          <p className="text-xs font-semibold text-text-muted">
            {pendingRequest.business_name}
            {pendingRequest.primary_category ? ` · ${pendingRequest.primary_category}` : ""} — sent{" "}
            {new Date(pendingRequest.created_at).toLocaleDateString("en-ZA")}.
          </p>
        </Card>
      )}

      {approved.map((r) => (
        <Card key={r.id} className="flex flex-col gap-1">
          <p className="text-sm font-extrabold text-ink">Approved</p>
          <p className="text-xs font-semibold text-text-muted">
            You can now create {r.business_name}
            {r.primary_category ? ` (${r.primary_category})` : ""}.
          </p>
        </Card>
      ))}

      <VendorOnboardingForm categories={(categoryRows ?? []).map((c) => c.name)} />
    </main>
  );
}
