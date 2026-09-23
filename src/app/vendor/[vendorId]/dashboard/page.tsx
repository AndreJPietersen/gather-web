import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isInstallmentOverdue } from "@/lib/upcoming";
import { getVendorAccess } from "../access";
import { getVendorRatingSummary, getVendorReviews } from "@/lib/vendor-reviews";
import { ProfileCompletionNudge } from "./profile-completion-nudge";

interface VendorRow {
  id: string;
  name: string;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  is_featured: boolean;
  logo_path: string | null;
  description: string | null;
}

interface BookingQuoteRow {
  id: string;
  vendor_quotes: { id: string }[];
}

// Replaces what used to be one long stacked page (profile checklist +
// bookings list + services list + social links list + gallery grid, all
// inline) — Andre: "it's getting long and cluttered." Same launch-grid
// pattern as the event page's own nav grid (src/app/events/[id]/page.tsx):
// a 2-column grid of tint tiles cycling primary/secondary/success-soft,
// text-ink (not text-secondary) on the yellow tiles for the same contrast
// reason that grid's own comment documents, each tile its own screen
// instead of a section sharing this page's scroll.
export default async function VendorDashboardPage({ params }: PageProps<"/vendor/[vendorId]/dashboard">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, verification_status, is_featured, logo_path, description")
    .eq("id", vendorId)
    .maybeSingle<VendorRow>();
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

  const [{ data: bookings }, { data: galleryImages }, { data: services }, { data: socialLinks }, ratingSummary, reviews] =
    await Promise.all([
      supabase.from("event_vendors").select("id, vendor_quotes(id)").eq("vendor_id", vendorId).returns<BookingQuoteRow[]>(),
      supabase.from("vendor_gallery_images").select("id").eq("vendor_id", vendorId),
      supabase.from("vendor_services").select("id").eq("vendor_id", vendorId),
      supabase.from("vendor_social_links").select("id").eq("vendor_id", vendorId),
      getVendorRatingSummary(supabase, vendorId),
      getVendorReviews(supabase, vendorId),
    ]);

  // A booking with no quote submitted yet needs the vendor's attention —
  // the same "something actually urgent" bar the event page's own Payments
  // dot sets, not every merely-unconfirmed booking.
  const needsQuote = (bookings ?? []).some((b) => b.vendor_quotes.length === 0);

  // Same three-hop shape (event_vendors -> payment_plans -> installments)
  // and the same isInstallmentOverdue check the event page's own
  // hasOverduePayment already uses, just scoped by vendor_id instead of
  // event_id.
  let hasOverduePayment = false;
  const eventVendorIds = (bookings ?? []).map((b) => b.id);
  if (eventVendorIds.length > 0) {
    const { data: planIds } = await supabase.from("payment_plans").select("id").in("event_vendor_id", eventVendorIds);
    const pIds = (planIds ?? []).map((p) => p.id);
    if (pIds.length > 0) {
      const { data: pendingInstallments } = await supabase
        .from("payment_installments")
        .select("status, due_date")
        .eq("status", "pending")
        .in("payment_plan_id", pIds)
        .returns<{ status: string; due_date: string }[]>();
      hasOverduePayment = (pendingInstallments ?? []).some((i) => isInstallmentOverdue(i.status, i.due_date));
    }
  }

  const unrepliedReviewCount = reviews.filter((r) => !r.reply).length;

  const logoUrl = vendor.logo_path ? supabase.storage.from("vendor-logos").getPublicUrl(vendor.logo_path).data.publicUrl : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-6 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="flex-1 font-display text-3xl font-semibold leading-[1.15] text-ink">{vendor.name}</h1>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a Storage public URL isn't a static/optimizable asset next/image can source-check at build time.
            <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-[14px] object-cover" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-secondary-soft))] font-display text-[15px] font-semibold text-primary">
              {vendor.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-pill ${vendor.verification_status === "verified" ? "bg-success-soft" : "bg-secondary-soft"}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          {vendor.is_featured && (
            <span className="flex items-center gap-1 rounded-pill bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--color-ink)">
                <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
              </svg>
              Featured
            </span>
          )}
          {ratingSummary.count > 0 && (
            <span className="text-xs font-bold text-text-muted">
              {ratingSummary.average.toFixed(1)} ★ ({ratingSummary.count})
            </span>
          )}
        </div>
      </div>

      {canQuote && (
        <ProfileCompletionNudge
          vendorId={vendorId}
          input={{
            logoPath: vendor.logo_path,
            description: vendor.description,
            galleryCount: galleryImages?.length ?? 0,
            servicesCount: services?.length ?? 0,
            socialLinksCount: socialLinks?.length ?? 0,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={`/vendor/${vendorId}/dashboard/bookings`} className="relative flex flex-col gap-3 rounded-[20px] bg-primary-soft p-4">
          {needsQuote && (
            <span
              title="A booking is waiting on a quote"
              aria-label="A booking is waiting on a quote"
              className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-primary"
            />
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <polyline points="8 14 11 17 16 12"></polyline>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Bookings</span>
        </Link>

        <Link href={`/vendor/${vendorId}/dashboard/payments`} className="relative flex flex-col gap-3 rounded-[20px] bg-secondary-soft p-4">
          {hasOverduePayment && (
            <span
              title="A payment is overdue"
              aria-label="A payment is overdue"
              className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-ink"
            />
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7H6a2 2 0 0 1 0-4h12v4"></path>
            <path d="M4 7v11a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-4"></path>
            <circle cx="17" cy="14" r="1.2" fill="var(--color-ink)" stroke="none"></circle>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Payments</span>
        </Link>

        <Link href={`/vendor/${vendorId}/dashboard/services`} className="flex flex-col gap-3 rounded-[20px] bg-success-soft p-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.59 9.58a2 2 0 0 0 2.83 0l4.34-4.34a2 2 0 0 0 0-2.83z"></path>
            <circle cx="8.5" cy="8.5" r="1.2" fill="var(--color-success)" stroke="none"></circle>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Services</span>
        </Link>

        <Link href={`/vendor/${vendorId}/dashboard/gallery`} className="flex flex-col gap-3 rounded-[20px] bg-primary-soft p-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"></rect>
            <circle cx="9" cy="9" r="1.6"></circle>
            <path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L4 20"></path>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Gallery</span>
        </Link>

        <Link href={`/vendor/${vendorId}/dashboard/social-links`} className="flex flex-col gap-3 rounded-[20px] bg-secondary-soft p-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2"></path>
            <path d="M15 7h2a5 5 0 1 1 0 10h-2"></path>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Social Links</span>
        </Link>

        <Link href={`/vendor/${vendorId}/dashboard/reviews`} className="relative flex flex-col gap-3 rounded-[20px] bg-success-soft p-4">
          {unrepliedReviewCount > 0 && (
            <span className="absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1 text-[11px] font-extrabold text-white">
              {unrepliedReviewCount}
            </span>
          )}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Reviews</span>
        </Link>

        <Link href={`/vendor/${vendorId}/team`} className="flex flex-col gap-3 rounded-[20px] bg-primary-soft p-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span className="text-[13px] font-extrabold text-ink">Team</span>
        </Link>

        {canQuote && (
          <Link href={`/vendor/${vendorId}/edit`} className="flex flex-col gap-3 rounded-[20px] bg-secondary-soft p-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>
            </svg>
            <span className="text-[13px] font-extrabold text-ink">Business Profile</span>
          </Link>
        )}
      </div>
    </main>
  );
}
