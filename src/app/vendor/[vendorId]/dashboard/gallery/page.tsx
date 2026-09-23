import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../../access";
import { AddGalleryImageForm } from "../add-gallery-image-form";
import { removeVendorGalleryImage } from "../actions";
import { MAX_GALLERY_IMAGES } from "@/lib/gallery-limits";

interface GalleryImageRow {
  id: string;
  storage_path: string;
  caption: string | null;
}

export default async function VendorGalleryPage({ params }: PageProps<"/vendor/[vendorId]/dashboard/gallery">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, verification_status")
    .eq("id", vendorId)
    .maybeSingle<{ id: string; name: string; verification_status: "unclaimed" | "claim_pending" | "verified" }>();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) {
    notFound();
  }
  const canQuote = access.role === "owner" || access.role === "manager";
  const isVerified = vendor.verification_status === "verified";

  const { data: galleryImages } = await supabase
    .from("vendor_gallery_images")
    .select("id, storage_path, caption")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .returns<GalleryImageRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Gallery">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
      </PageHeader>

      {galleryImages && galleryImages.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {galleryImages.map((image) => {
            const { data: publicUrl } = supabase.storage.from("vendor-gallery").getPublicUrl(image.storage_path);
            return (
              <div key={image.id} className="relative overflow-hidden rounded-[18px] bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    Storage public URL isn't a static/optimizable asset
                    next/image can source-check at build time. */}
                <img src={publicUrl.publicUrl} alt={image.caption ?? ""} className="aspect-square w-full object-cover" />
                {canQuote && (
                  <form action={removeVendorGalleryImage} className="absolute right-1.5 top-1.5">
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="vendorId" value={vendorId} />
                    <input type="hidden" name="storagePath" value={image.storage_path} />
                    <button
                      type="submit"
                      aria-label="Remove photo"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-white"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </form>
                )}
                {image.caption && (
                  <p className="absolute inset-x-0 bottom-0 truncate bg-ink/60 px-2 py-1 text-[10px] font-semibold text-white">
                    {image.caption}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="text-sm font-semibold text-text-muted">No photos yet.</p>
        </Card>
      )}

      {canQuote &&
        (!isVerified ? (
          <Card>
            <p className="text-sm font-semibold text-text-muted">
              A photo gallery is only available to verified vendors — claim and verify this listing first.
            </p>
          </Card>
        ) : (galleryImages?.length ?? 0) >= MAX_GALLERY_IMAGES ? (
          <Card>
            <p className="text-sm font-semibold text-text-muted">
              This gallery is at its {MAX_GALLERY_IMAGES}-photo limit. Remove a photo to add a new one.
            </p>
          </Card>
        ) : (
          <AddGalleryImageForm vendorId={vendorId} />
        ))}
    </main>
  );
}
