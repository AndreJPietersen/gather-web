import Link from "next/link";
import { notFound } from "next/navigation";
import { Quote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { VerificationBadge } from "@/components/vendor/verification-badge";
import { VendorAvatar } from "@/components/vendor/vendor-avatar";
import { RatingSummaryCard } from "@/components/vendor/rating-summary-card";
import { ReviewCard } from "@/components/vendor/review-card";
import { createClient } from "@/lib/supabase/server";
import { getVendorRatingSummary, getVendorReviews, getEligibleBookingForReview } from "@/lib/vendor-reviews";
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
  is_featured: boolean;
  logo_path: string | null;
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
    .select("id, name, primary_category, description, phone, website, verification_status, is_featured, logo_path")
    .eq("id", id)
    .maybeSingle<VendorDetail>();

  if (!vendor) {
    notFound();
  }

  const logoUrl = vendor.logo_path ? supabase.storage.from("vendor-logos").getPublicUrl(vendor.logo_path).data.publicUrl : null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myEvents: { id: string; name: string }[] = [];
  if (user) {
    const { data } = await supabase.from("events").select("id, name").eq("owner_id", user.id).order("start_at", { ascending: true });
    myEvents = data ?? [];
  }

  const [ratingSummary, reviews, eligibleBooking] = await Promise.all([
    getVendorRatingSummary(supabase, vendor.id),
    getVendorReviews(supabase, vendor.id, 3),
    user ? getEligibleBookingForReview(supabase, vendor.id, user.id) : Promise.resolve(null),
  ]);

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
      <PageHeader
        title={vendor.name}
        action={
          <VendorAvatar
            name={vendor.name}
            category={vendor.primary_category}
            verified={vendor.verification_status === "verified"}
            logoUrl={logoUrl}
            size={44}
            radius={14}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <VerificationBadge verified={vendor.verification_status === "verified"} description={vendor.description} />
          {vendor.is_featured && (
            <span className="flex items-center gap-1 rounded-pill bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--color-ink)">
                <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
              </svg>
              Featured
            </span>
          )}
        </div>
        {vendor.primary_category && <p className="text-sm font-semibold text-text-muted">{vendor.primary_category}</p>}
      </PageHeader>

      {/* Moved up from the bottom of the page (Andre's own feedback — it
          used to sit below the whole Reviews section, which had pushed it
          out of view without scrolling past everything else first). Adding
          a vendor to an event is the primary action this page exists for a
          signed-in planner to take, so it now sits right under the header,
          before anything that's informing the decision rather than acting
          on it. */}
      {myEvents.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Add to an event</h2>
          <div className="mt-3">
            <AssociateEventForm vendorId={vendor.id} events={myEvents} />
          </div>
        </div>
      )}

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

      <RatingSummaryCard summary={ratingSummary} title="Reviews">
        <div>
          {eligibleBooking ? (
            <LinkButton href={`/vendors/${vendor.id}/reviews/write`} variant="primary" className="w-full">
              {eligibleBooking.existingReview ? "Edit Your Review" : "Write a Review"}
            </LinkButton>
          ) : (
            <p className="text-center text-[11px] font-semibold text-text-muted">
              You can review a vendor once your booking with them is confirmed.
            </p>
          )}
        </div>
      </RatingSummaryCard>

      {reviews.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {ratingSummary.count > reviews.length && (
            <Link
              href={`/vendors/${vendor.id}/reviews`}
              className="rounded-pill border-2 border-border bg-surface px-4 py-3.5 text-center text-[14.5px] font-extrabold text-text"
            >
              See all {ratingSummary.count} reviews
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
