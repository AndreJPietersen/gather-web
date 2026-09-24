import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../access";
import { EditVendorForm } from "./edit-vendor-form";
import { LogoUploadForm } from "./logo-upload-form";
import { ProfileCompletionCard } from "../dashboard/profile-completion-card";

interface EditableVendor {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  logo_path: string | null;
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
    .select("id, name, primary_category, description, phone, website, verification_status, logo_path, created_by")
    .eq("id", vendorId)
    .maybeSingle<EditableVendor>();

  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  const { data: categoryRows } = await supabase.from("service_categories").select("name").eq("is_active", true).order("name");

  const isUnclaimedCreator = vendor.verification_status === "unclaimed" && vendor.created_by === user?.id;
  const canEdit = isUnclaimedCreator || access.role === "owner" || access.role === "manager";
  if (!canEdit) {
    notFound();
  }

  const logoUrl = vendor.logo_path ? supabase.storage.from("vendor-logos").getPublicUrl(vendor.logo_path).data.publicUrl : null;

  // Only fetched for the completion checklist below — access.role is
  // already known to be owner/manager here (canEdit), same tier the
  // checklist was always gated to on the old dashboard.
  const [{ data: galleryImages }, { data: services }, { data: socialLinks }] = await Promise.all([
    supabase.from("vendor_gallery_images").select("id").eq("vendor_id", vendorId),
    supabase.from("vendor_services").select("id").eq("vendor_id", vendorId),
    supabase.from("vendor_social_links").select("id").eq("vendor_id", vendorId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Edit Business Details" />

      <ProfileCompletionCard
        vendorId={vendor.id}
        input={{
          logoPath: vendor.logo_path,
          description: vendor.description,
          galleryCount: galleryImages?.length ?? 0,
          servicesCount: services?.length ?? 0,
          socialLinksCount: socialLinks?.length ?? 0,
        }}
      />

      <div id="logo">
        <LogoUploadForm vendorId={vendor.id} logoUrl={logoUrl} />
      </div>
      <div id="description">
        <EditVendorForm
          vendorId={vendor.id}
          name={vendor.name}
          primaryCategory={vendor.primary_category ?? ""}
          description={vendor.description ?? ""}
          phone={vendor.phone ?? ""}
          website={vendor.website ?? ""}
          categories={(categoryRows ?? []).map((c) => c.name)}
        />
      </div>
    </main>
  );
}
