import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../access";
import { EditVendorForm } from "./edit-vendor-form";

interface EditableVendor {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  created_by: string;
}

// Business core fields (name/category/description/phone/website) were
// previously only ever set once, at vendor-registration time — this is the
// only way back to them afterward, gated to mirror
// vendors_update_creator_stub_or_owner_manager exactly (owner/manager, OR
// the creator of a still-unclaimed stub) so the page doesn't show a form
// that would just fail at the database.
export default async function EditVendorPage({ params }: PageProps<"/vendor/[vendorId]/edit">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, primary_category, description, phone, website, verification_status, created_by")
    .eq("id", vendorId)
    .maybeSingle<EditableVendor>();

  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);

  const isUnclaimedCreator = vendor.verification_status === "unclaimed" && vendor.created_by === user?.id;
  const canEdit = isUnclaimedCreator || access.role === "owner" || access.role === "manager";
  if (!canEdit) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink">Edit Business Details</h1>
      </div>
      <EditVendorForm
        vendorId={vendor.id}
        name={vendor.name}
        primaryCategory={vendor.primary_category ?? ""}
        description={vendor.description ?? ""}
        phone={vendor.phone ?? ""}
        website={vendor.website ?? ""}
      />
    </main>
  );
}
