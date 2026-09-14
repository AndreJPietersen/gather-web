import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ClaimForm } from "./claim-form";

interface ExistingClaim {
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
}

export default async function ClaimVendorPage({ params }: PageProps<"/vendors/[id]/claim">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vendor } = await supabase.from("vendors").select("id, name, verification_status").eq("id", id).maybeSingle();
  if (!vendor) {
    notFound();
  }
  if (vendor.verification_status === "verified") {
    redirect(`/vendors/${vendor.id}`);
  }

  // Shows a status message instead of the form if this user already has a
  // claim in flight — mirrors the Salesforce build's gatherVendorClaim.
  const { data: existingClaim } = await supabase
    .from("vendor_claim_requests")
    .select("status, rejection_reason")
    .eq("vendor_id", vendor.id)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ExistingClaim>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Claim {vendor.name}</h1>
          <p className="mt-1 text-sm font-semibold text-text-muted">
            Tell us how we can confirm this is your business.
          </p>
        </div>
      </div>

      {existingClaim ? (
        <Card>
          {existingClaim.status === "pending" && (
            <p className="text-sm font-bold text-text">Your claim is pending review.</p>
          )}
          {existingClaim.status === "approved" && (
            <p className="text-sm font-bold text-text">Your claim was approved.</p>
          )}
          {existingClaim.status === "rejected" && (
            <div>
              <p className="text-sm font-bold text-text">Your previous claim was rejected.</p>
              {existingClaim.rejection_reason && (
                <p className="mt-1 text-sm font-semibold text-text-muted">{existingClaim.rejection_reason}</p>
              )}
            </div>
          )}
        </Card>
      ) : (
        <ClaimForm vendorId={vendor.id} />
      )}
    </main>
  );
}
