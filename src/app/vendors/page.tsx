import Link from "next/link";
import { Card, LinkCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { VerificationBadge } from "@/components/vendor/verification-badge";
import { VendorAvatar } from "@/components/vendor/vendor-avatar";
import { VendorRatingBadge } from "@/components/vendor/vendor-rating-badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { rankVendors } from "@/lib/vendor-ranking";
import { getVendorRatingSummaries } from "@/lib/vendor-reviews";

interface VendorRow {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  is_featured: boolean;
  featured_rank: number | null;
  logo_path: string | null;
  created_at: string;
}

// The real guest-browsable vendor directory — redesigned into an actual
// marketplace (a Featured row, photo-forward cards) rather than a plain
// text-row list, off a design canvas Andre picked. Every vendor (not just
// verified ones) still shows, each badged by status — the crowd-sourced
// Vendor Directory Bootstrapping workflow only works if unclaimed stubs
// stay visible, not hidden until claimed. Category pills + keyword search,
// both server-rendered via plain GET search params (no client JS needed for
// search itself). The old manual Name A→Z sort toggle is gone deliberately
// — it directly fought the new point of this page, letting vendors compete
// for a better spot via rankVendors (Featured, then profile completeness,
// then verification) instead of a passive alphabetical order.
export default async function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  const { q, category } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const activeCategory = typeof category === "string" ? category : "";

  function buildHref(overrides: { category?: string }) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const nextCategory = overrides.category !== undefined ? overrides.category : activeCategory;
    if (nextCategory) params.set("category", nextCategory);
    const qs = params.toString();
    return qs ? `/vendors?${qs}` : "/vendors";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: categoryRows } = await supabase
    .from("vendors")
    .select("primary_category")
    .not("primary_category", "is", null)
    .returns<{ primary_category: string }[]>();
  const categories = Array.from(new Set((categoryRows ?? []).map((row) => row.primary_category))).sort();

  let vendorsQuery = supabase
    .from("vendors")
    .select("id, name, primary_category, description, verification_status, is_featured, featured_rank, logo_path, created_at");
  if (activeCategory) {
    vendorsQuery = vendorsQuery.eq("primary_category", activeCategory);
  }
  if (query) {
    vendorsQuery = vendorsQuery.ilike("name", `%${query}%`);
  }
  const { data: vendorRows } = await vendorsQuery.returns<VendorRow[]>();

  const ranked = await rankVendors(supabase, vendorRows ?? []);
  const logoUrls = new Map(
    ranked
      .filter((v) => v.logo_path)
      .map((v) => [v.id, supabase.storage.from("vendor-logos").getPublicUrl(v.logo_path!).data.publicUrl]),
  );
  const ratingSummaries = await getVendorRatingSummaries(
    supabase,
    ranked.map((v) => v.id),
  );

  const featured = ranked.filter((v) => v.is_featured);
  const rest = ranked.filter((v) => !v.is_featured);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Vendors</h1>
          <p className="mt-1 text-sm font-semibold text-text-muted">Find vendors for your event.</p>
        </div>
        {user && (
          <Link href="/vendors/add" className="rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white">
            + Add
          </Link>
        )}
      </div>

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Search vendors" className="flex-1" />
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref({ category: "" })}
            className={cn(
              "rounded-pill px-3 py-1.5 text-xs font-extrabold",
              !activeCategory ? "bg-primary-soft text-primary" : "bg-surface text-text-muted border-2 border-border",
            )}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={buildHref({ category: cat })}
              className={cn(
                "rounded-pill px-3 py-1.5 text-xs font-extrabold",
                activeCategory === cat ? "bg-primary-soft text-primary" : "bg-surface text-text-muted border-2 border-border",
              )}
            >
              {cat}
            </Link>
          ))}
        </div>
      )}

      {featured.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-secondary)" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
            </svg>
            <h2 className="font-display text-base font-semibold text-ink">Featured</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {featured.map((vendor) => (
              <LinkCard
                key={vendor.id}
                href={`/vendors/${vendor.id}`}
                className="flex w-[210px] shrink-0 flex-col gap-2.5 rounded-[24px] p-4 text-white"
                style={{ background: `linear-gradient(135deg, oklch(62% 0.18 340), oklch(66% 0.16 5))` }}
              >
                <span className="flex w-fit items-center gap-1 rounded-pill bg-white/90 px-2 py-0.5 text-[9px] font-extrabold uppercase text-ink">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--color-ink)">
                    <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
                  </svg>
                  Featured
                </span>
                <VendorAvatar
                  name={vendor.name}
                  category={vendor.primary_category}
                  verified={vendor.verification_status === "verified"}
                  logoUrl={logoUrls.get(vendor.id) ?? null}
                  size={52}
                  radius={16}
                />
                <div>
                  <p className="text-[15px] font-extrabold leading-tight">{vendor.name}</p>
                  {vendor.primary_category && <p className="mt-0.5 text-[11px] font-bold text-white/85">{vendor.primary_category}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {vendor.verification_status === "verified" && (
                    <div className="flex items-center gap-1">
                      <span className="flex h-4 w-4 items-center justify-center rounded-pill bg-success">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                      <span className="text-[10px] font-extrabold uppercase text-white/90">Verified</span>
                    </div>
                  )}
                  {ratingSummaries.has(vendor.id) && (
                    <VendorRatingBadge average={ratingSummaries.get(vendor.id)!.average} count={ratingSummaries.get(vendor.id)!.count} light />
                  )}
                </div>
              </LinkCard>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {featured.length > 0 && <h2 className="font-display text-base font-semibold text-ink">All Vendors</h2>}
        <StaggerList className="grid grid-cols-2 gap-2.5">
          {rest.length > 0 || featured.length > 0 ? (
            rest.map((vendor) => (
              <StaggerItem key={vendor.id}>
                <LinkCard href={`/vendors/${vendor.id}`} className="flex flex-col gap-2 p-3.5">
                  <VendorAvatar
                    name={vendor.name}
                    category={vendor.primary_category}
                    verified={vendor.verification_status === "verified"}
                    logoUrl={logoUrls.get(vendor.id) ?? null}
                    size={44}
                    radius={14}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-text">{vendor.name}</p>
                    {vendor.primary_category && (
                      <p className="truncate text-[11px] font-bold text-text-muted">{vendor.primary_category}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <VerificationBadge verified={vendor.verification_status === "verified"} description={vendor.description} />
                    {ratingSummaries.has(vendor.id) && (
                      <VendorRatingBadge average={ratingSummaries.get(vendor.id)!.average} count={ratingSummaries.get(vendor.id)!.count} />
                    )}
                  </div>
                </LinkCard>
              </StaggerItem>
            ))
          ) : (
            <Card className="col-span-2">
              <p className="text-sm font-semibold text-text-muted">No vendors match yet — check back soon.</p>
            </Card>
          )}
        </StaggerList>
      </div>
    </main>
  );
}
