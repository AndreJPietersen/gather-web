import { notFound } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime, formatZAR } from "@/lib/utils";
import { getVendorAccess } from "../access";
import { SubmitQuoteForm } from "./submit-quote-form";
import { AddServiceForm } from "./add-service-form";
import { AddSocialLinkForm } from "./add-social-link-form";
import { AddGalleryImageForm } from "./add-gallery-image-form";
import { MAX_GALLERY_IMAGES } from "@/lib/gallery-limits";
import { removeService, removeSocialLink, removeVendorGalleryImage } from "./actions";

interface BookingRow {
  id: string;
  status: string;
  confirmed: boolean;
  events: { name: string; start_at: string } | null;
  vendor_quotes: { id: string; amount: string; status: string }[];
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  service_categories: { name: string } | null;
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

export default async function VendorDashboardPage({ params }: PageProps<"/vendor/[vendorId]/dashboard">) {
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

  // event_vendors_select_event_side_or_vendor_side's is_vendor_team_member
  // branch is a live join, not a snapshot — a teammate added after this
  // booking already existed still sees it here, the direct fix for the
  // documented Salesforce limitation.
  const { data: bookings } = await supabase
    .from("event_vendors")
    .select("id, status, confirmed, events(name, start_at), vendor_quotes(id, amount, status)")
    .eq("vendor_id", vendorId)
    .returns<BookingRow[]>();

  const [{ data: services }, { data: serviceCategories }] = await Promise.all([
    supabase
      .from("vendor_services")
      .select("id, name, description, category_id, service_categories(name)")
      .eq("vendor_id", vendorId)
      .returns<ServiceRow[]>(),
    supabase.from("service_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  const isVerified = vendor.verification_status === "verified";

  const [{ data: socialLinks }, { data: galleryImages }] = await Promise.all([
    supabase.from("vendor_social_links").select("id, platform, url").eq("vendor_id", vendorId).returns<SocialLinkRow[]>(),
    supabase
      .from("vendor_gallery_images")
      .select("id, storage_path, caption")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .returns<GalleryImageRow[]>(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-semibold text-ink">{vendor.name}</h1>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {canQuote && (
            <Link href={`/vendor/${vendorId}/edit`} className="text-xs font-extrabold text-primary">
              Edit Business
            </Link>
          )}
          <Link href={`/vendor/${vendorId}/team`} className="text-xs font-extrabold text-primary">
            Manage Team
          </Link>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Bookings</h2>
        <StaggerList className="mt-3 flex flex-col gap-2">
          {bookings && bookings.length > 0 ? (
            bookings.map((booking) => (
              <StaggerItem key={booking.id}>
                <Card className="flex flex-col gap-1">
                  <p className="text-sm font-extrabold text-text">{booking.events?.name ?? "Event"}</p>
                  {booking.events?.start_at && (
                    <p className="text-xs font-semibold text-text-muted">{formatEventDateTime(booking.events.start_at)}</p>
                  )}
                  {booking.vendor_quotes.length > 0 && (
                    <div className="mt-1 flex flex-col gap-1">
                      {booking.vendor_quotes.map((quote) => (
                        <p key={quote.id} className="text-xs font-semibold text-text-muted">
                          Quote: {formatZAR(quote.amount)} · {quote.status}
                        </p>
                      ))}
                    </div>
                  )}
                  {canQuote && <SubmitQuoteForm eventVendorId={booking.id} vendorId={vendorId} />}
                </Card>
              </StaggerItem>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No bookings yet.</p>
            </Card>
          )}
        </StaggerList>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Services</h2>
        <StaggerList className="mt-3 flex flex-col gap-2">
          {services && services.length > 0 ? (
            services.map((service) => (
              <StaggerItem key={service.id}>
                <Card className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-text">{service.name}</p>
                    <p className="text-xs font-semibold text-text-muted">{service.service_categories?.name ?? "Uncategorized"}</p>
                    {service.description && <p className="text-xs font-semibold text-text-muted">{service.description}</p>}
                  </div>
                  {canQuote && (
                    <form action={removeService}>
                      <input type="hidden" name="serviceId" value={service.id} />
                      <input type="hidden" name="vendorId" value={vendorId} />
                      <button type="submit" className="text-xs font-extrabold text-primary">
                        Remove
                      </button>
                    </form>
                  )}
                </Card>
              </StaggerItem>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No services listed yet.</p>
            </Card>
          )}
        </StaggerList>
        {canQuote && (
          <div className="mt-3">
            <AddServiceForm vendorId={vendorId} categories={serviceCategories ?? []} />
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Social Links</h2>
        <StaggerList className="mt-3 flex flex-col gap-2">
          {socialLinks && socialLinks.length > 0 ? (
            socialLinks.map((link) => (
              <StaggerItem key={link.id}>
                <Card className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-text">{link.platform}</p>
                    <a href={link.url} target="_blank" rel="noreferrer" className="text-xs font-semibold">
                      {link.url}
                    </a>
                  </div>
                  {canQuote && (
                    <form action={removeSocialLink}>
                      <input type="hidden" name="linkId" value={link.id} />
                      <input type="hidden" name="vendorId" value={vendorId} />
                      <button type="submit" className="text-xs font-extrabold text-primary">
                        Remove
                      </button>
                    </form>
                  )}
                </Card>
              </StaggerItem>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No social links added yet.</p>
            </Card>
          )}
        </StaggerList>
        {canQuote && (
          <div className="mt-3">
            {isVerified ? (
              <AddSocialLinkForm vendorId={vendorId} />
            ) : (
              <Card>
                <p className="text-sm font-semibold text-text-muted">
                  Social links are only available to verified vendors — claim and verify this listing first.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Gallery</h2>
        {galleryImages && galleryImages.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
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
          <Card className="mt-3">
            <p className="text-sm font-semibold text-text-muted">No photos yet.</p>
          </Card>
        )}
        {canQuote && (
          <div className="mt-3">
            {!isVerified ? (
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
            )}
          </div>
        )}
      </div>
    </main>
  );
}
