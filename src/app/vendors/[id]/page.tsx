import Link from "next/link";
import { notFound } from "next/navigation";
import { Quote } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { VerificationBadge } from "@/components/vendor/verification-badge";
import { createClient } from "@/lib/supabase/server";
import { AssociateEventForm } from "./associate-event-form";
import { VendorGalleryCarousel } from "./vendor-gallery-carousel";

interface VendorDetail {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
}

interface SocialLinkRow {
  id: string;
  platform: string;
  url: string;
}

interface GalleryImageRow {
  id: string;
  storage_path: string;
  caption: string | null;
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

  // Social links/gallery are only ever populated for verified vendors (RLS
  // gates writes to that status), so skip the queries entirely rather than
  // asking for rows that can't exist on every unverified/unclaimed listing.
  let socialLinks: SocialLinkRow[] = [];
  let galleryImages: GalleryImageRow[] = [];
  if (vendor.verification_status === "verified") {
    const [{ data: links }, { data: images }] = await Promise.all([
      supabase.from("vendor_social_links").select("id, platform, url").eq("vendor_id", vendor.id).returns<SocialLinkRow[]>(),
      supabase
        .from("vendor_gallery_images")
        .select("id, storage_path, caption")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .returns<GalleryImageRow[]>(),
    ]);
    socialLinks = links ?? [];
    galleryImages = images ?? [];
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink">{vendor.name}</h1>
        <VerificationBadge verified={vendor.verification_status === "verified"} description={vendor.description} />
        {vendor.primary_category && (
          <p className="mt-1 text-sm font-semibold text-text-muted">{vendor.primary_category}</p>
        )}
      </div>

      {galleryImages.length > 0 && (
        <div className="-mx-6">
          <VendorGalleryCarousel
            altBase={`${vendor.name} gallery photo`}
            images={galleryImages.map((image) => ({
              id: image.id,
              caption: image.caption,
              url: supabase.storage.from("vendor-gallery").getPublicUrl(image.storage_path).data.publicUrl,
            }))}
          />
        </div>
      )}

      {vendor.description &&
        (galleryImages.length === 0 ? (
          // No photos to lead with yet — a bigger, decorated treatment of
          // the vendor's own words stands in for a hero image instead of
          // just repeating the same small text card the gallery would
          // otherwise use.
          <Card className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-primary-soft via-surface to-secondary-soft px-6 py-8">
            <Quote size={28} strokeWidth={2.5} className="text-primary/40" />
            <p className="mt-3 text-lg font-semibold leading-relaxed text-ink">{vendor.description}</p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text">{vendor.description}</p>
          </Card>
        ))}

      {(vendor.phone || vendor.website || socialLinks.length > 0) && (
        <Card className="flex flex-col gap-1">
          {vendor.phone && <p className="text-sm font-bold text-text">{vendor.phone}</p>}
          {vendor.website && (
            <a href={vendor.website} target="_blank" rel="noreferrer" className="text-sm font-bold">
              {vendor.website}
            </a>
          )}
          {socialLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="text-sm font-bold">
              {link.platform}
            </a>
          ))}
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
