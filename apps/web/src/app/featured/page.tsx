import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getSessionContext } from "@/lib/session";
import { formatZAR } from "@gather/shared/utils";
import { FEATURE_DURATIONS, FEATURE_SPOTS, findPrice } from "@gather/shared/feature-pricing";
import { getFeaturePrices } from "@/lib/vendor-feature-status";
import { getFeaturedEnabled } from "@/lib/app-settings";

// Public pricing page for featured placements. Prices come from the
// admin-managed feature_prices list (/admin/featured/pricing); an empty
// price reads "Price on request". The call to action depends on who's
// looking: a vendor Owner goes straight to their request screen, anyone else
// is pointed at listing a business first.
export default async function FeaturedPricingPage() {
  const [session, prices, featuredEnabled] = await Promise.all([getSessionContext(), getFeaturePrices(), getFeaturedEnabled()]);
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
  const ownedVendor =
    session.status === "authenticated"
      ? session.personas.find((p) => p.type === "vendor" && p.role === "owner")
      : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Get featured">
        <p className="text-sm font-semibold text-text-muted">
          Featured vendors show first on the marketplace and the home page, with a Featured badge next to their name.
        </p>
      </PageHeader>

      {FEATURE_SPOTS.map((spot) => (
        <Card key={spot.id} className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{spot.label}</h2>
            <p className="text-xs font-semibold text-text-muted">{spot.description}</p>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {FEATURE_DURATIONS.map((duration) => {
              const price = findPrice(prices, spot.id, duration.id);
              return (
                <div key={duration.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-bold text-text">{duration.label}</span>
                  <span className={price !== null ? "font-extrabold text-ink" : "font-semibold text-text-muted"}>
                    {price !== null ? formatZAR(price) : "Price on request"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <p className="text-xs font-semibold text-text-muted">
        Nothing is charged when you ask. Gather confirms the price and your dates with you first, and your spot only goes
        live once it&apos;s confirmed.
      </p>

      {ownedVendor && ownedVendor.type === "vendor" ? (
        <LinkButton href={`/vendor/${ownedVendor.vendorId}/featured`} variant="accent">
          Request a spot for {ownedVendor.vendorName}
        </LinkButton>
      ) : session.status === "authenticated" ? (
        <p className="text-center text-xs font-semibold text-text-muted">
          Only a business owner can request a featured spot.
        </p>
      ) : (
        <LinkButton href="/register?persona=vendor" variant="accent">
          List your business
        </LinkButton>
      )}
    </main>
  );
}
