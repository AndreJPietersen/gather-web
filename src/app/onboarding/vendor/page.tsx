import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { VendorOnboardingForm } from "./onboarding-form";

export default async function VendorOnboardingPage() {
  const session = await getSessionContext();
  if (session.status === "guest") {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Set up your business</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">You&apos;ll be the Owner — add teammates later.</p>
      </div>
      <VendorOnboardingForm />
    </main>
  );
}
