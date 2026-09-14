import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { AssociateEventForm } from "./associate-event-form";

interface VendorDetail {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
}

// Guest vendor profile. Relying on the `vendors_select_public_or_own` RLS
// policy to decide visibility (not re-checking verification_status here) —
// Phase 6 widened it so unclaimed/claim_pending vendors are publicly
// visible too, not just verified ones (see that policy's own comment).
// Service listings management is Phase 8's vendor dashboard.
export default async function VendorProfilePage({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, primary_category, description, phone, website, verification_status")
    .eq("id", id)
    .maybeSingle<VendorDetail>();

  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myEvents: { id: string; name: string }[] = [];
  if (user) {
    const { data } = await supabase.from("events").select("id, name").eq("owner_id", user.id).order("start_at", { ascending: true });
    myEvents = data ?? [];
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-semibold text-ink">{vendor.name}</h1>
          {vendor.verification_status === "verified" ? (
            <span className="rounded-pill bg-success-soft px-2 py-0.5 text-xs font-extrabold text-ink">Verified</span>
          ) : (
            <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-xs font-extrabold text-ink">
              Unverified
            </span>
          )}
        </div>
        {vendor.primary_category && (
          <p className="mt-1 text-sm font-semibold text-text-muted">{vendor.primary_category}</p>
        )}
      </div>

      {vendor.description && (
        <Card>
          <p className="text-sm font-semibold text-text">{vendor.description}</p>
        </Card>
      )}

      {(vendor.phone || vendor.website) && (
        <Card className="flex flex-col gap-1">
          {vendor.phone && <p className="text-sm font-bold text-text">{vendor.phone}</p>}
          {vendor.website && (
            <a href={vendor.website} target="_blank" rel="noreferrer" className="text-sm font-bold">
              {vendor.website}
            </a>
          )}
        </Card>
      )}

      {vendor.verification_status !== "verified" && (
        <Link href={`/vendors/${vendor.id}/claim`} className="text-sm font-extrabold text-primary">
          Is this your business? Claim this listing
        </Link>
      )}

      {myEvents.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Add to an event</h2>
          <div className="mt-3">
            <AssociateEventForm vendorId={vendor.id} events={myEvents} />
          </div>
        </div>
      )}
    </main>
  );
}
