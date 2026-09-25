import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate } from "@gather/shared/utils";
import { durationLabel, nextDay, spotLabel } from "@gather/shared/feature-pricing";
import { getFeaturePrices, getVendorFeatureStatus } from "@/lib/vendor-feature-status";
import { sastDayKey } from "@/lib/vendor-ranking";
import { getVendorAccess } from "../access";
import { getFeaturedEnabled } from "@/lib/app-settings";
import { FeatureRequestForm } from "./feature-request-form";
import { withdrawFeaturedRequest } from "./actions";

// Where a vendor asks for a featured spot (reached from the dashboard card or
// the marketplace's "Your spot here" card). Any team member can see where
// things stand; only the Owner gets the form or the Withdraw button.
export default async function VendorFeaturedPage({ params, searchParams }: PageProps<"/vendor/[vendorId]/featured">) {
  const { vendorId } = await params;
  const { sent, start } = await searchParams;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", vendorId).maybeSingle<{ id: string; name: string }>();
  if (!vendor) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) notFound();
  const isOwner = access.role === "owner";

  const [status, prices, featuredEnabled] = await Promise.all([getVendorFeatureStatus(vendorId), getFeaturePrices(), getFeaturedEnabled()]);

  if (!featuredEnabled) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-10">
        <PageHeader title="Get featured" />
        <Card>
          <p className="text-sm font-semibold text-text-muted">
            Featured spots aren&apos;t available yet — we&apos;ll open them up as more planners join Gather.
          </p>
        </Card>
      </main>
    );
  }
  const today = sastDayKey();
  // An extension starts the day after the current placement ends; a
  // ?start= from the dashboard's Extend link wins if it is still in the future.
  const requestedStart = typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) && start >= today ? start : null;
  const defaultStart = requestedStart ?? (status.current ? nextDay(status.current.endsOn) : today);

  if (sent === "1" && status.pending) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-soft text-3xl text-ink">★</span>
        <h1 className="font-display text-2xl font-semibold text-ink">Request sent</h1>
        <p className="text-sm font-semibold text-text-muted">
          Gather will be in touch to confirm the price and your dates. You can see its status on your dashboard any time.
        </p>
        <LinkButton href={`/vendor/${vendorId}/dashboard`} variant="accent" className="mt-4 w-full">
          Back to dashboard
        </LinkButton>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-6 py-10">
      <PageHeader title="Get featured">
        <p className="text-sm font-semibold text-text-muted">
          Featured vendors show first on the marketplace and the home page, with a Featured badge.
        </p>
      </PageHeader>

      {status.current && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-extrabold text-ink">{status.current.state === "live" ? "You're featured" : "Featured spot booked"}</p>
          <p className="text-xs font-semibold text-text-muted">
            {status.current.state === "live"
              ? `Until ${formatEventDate(status.current.endsOn)}`
              : `From ${formatEventDate(status.current.startsOn)} to ${formatEventDate(status.current.endsOn)}`}
          </p>
        </Card>
      )}

      {status.pending ? (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-ink">Request waiting</p>
            <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">Pending</span>
          </div>
          <p className="text-xs font-semibold text-text-muted">
            {status.pending.requestedSpot ? spotLabel(status.pending.requestedSpot) : "Featured spot"}
            {status.pending.requestedDuration ? ` · ${durationLabel(status.pending.requestedDuration)}` : ""} · from{" "}
            {formatEventDate(status.pending.startsOn)}. Gather will confirm the price and dates before anything goes live.
          </p>
          {isOwner && (
            <form action={withdrawFeaturedRequest}>
              <input type="hidden" name="vendorId" value={vendorId} />
              <input type="hidden" name="placementId" value={status.pending.id} />
              <button type="submit" className="text-xs font-extrabold text-primary">
                Withdraw request
              </button>
            </form>
          )}
        </Card>
      ) : isOwner ? (
        <FeatureRequestForm vendorId={vendorId} prices={prices} defaultStart={defaultStart} minStart={today} />
      ) : (
        <Card>
          <p className="text-sm font-semibold text-text-muted">
            Only the business owner can request a featured spot, since it commits the business to paying.
          </p>
        </Card>
      )}
    </main>
  );
}
