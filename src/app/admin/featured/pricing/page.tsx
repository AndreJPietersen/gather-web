import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { BackButton } from "@/components/ui/back-button";
import { getFeaturePrices } from "@/lib/vendor-feature-status";
import { PricingForm } from "./pricing-form";

// The price list vendors see on /featured and next to each option when they
// request a spot. Prices are shown, not charged — an admin still confirms and
// activates every placement.
export default async function AdminFeaturePricingPage() {
  await requireAdmin();
  const prices = await getFeaturePrices();

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Featured pricing</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">
          Shown on the public{" "}
          <Link href="/featured" className="font-extrabold text-primary">
            pricing page
          </Link>{" "}
          and on a vendor&apos;s request screen. Leave a price blank to show &ldquo;Price on request.&rdquo; A new request
          records the price listed at the time, which you can still change on the placement.
        </p>
      </div>
      <PricingForm prices={prices} />
    </div>
  );
}
