import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { VerificationBadge } from "@/components/vendor/verification-badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

interface VendorRow {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
}

// The real guest-browsable vendor directory. Phase 6 widened this to show
// every vendor (not just verified ones), each badged by status — the
// crowd-sourced Vendor Directory Bootstrapping workflow only works if
// unclaimed stubs are actually visible in the directory, not hidden until
// claimed. Category pills + keyword search, both server-rendered via plain
// GET search params (no client JS needed for search itself).
export default async function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  const { q, category, sort } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const activeCategory = typeof category === "string" ? category : "";
  // Name-ascending (A→Z) was already the fixed default — this just makes
  // the direction a real, toggleable choice instead of a silent one. "asc"
  // stays paramless so existing bookmarked/shared search+category URLs
  // keep meaning what they already meant.
  const sortDirection: "asc" | "desc" = sort === "desc" ? "desc" : "asc";

  // Builds a /vendors URL carrying whichever of q/category/sort are active,
  // with just one overridden — so toggling sort keeps the current search
  // and category, and picking a category keeps the current sort, instead
  // of each control silently discarding the others' state.
  function buildHref(overrides: { category?: string; sort?: "asc" | "desc" }) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const nextCategory = overrides.category !== undefined ? overrides.category : activeCategory;
    if (nextCategory) params.set("category", nextCategory);
    const nextSort = overrides.sort ?? sortDirection;
    if (nextSort === "desc") params.set("sort", "desc");
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

  let vendorsQuery = supabase.from("vendors").select("id, name, primary_category, description, verification_status");
  if (activeCategory) {
    vendorsQuery = vendorsQuery.eq("primary_category", activeCategory);
  }
  if (query) {
    vendorsQuery = vendorsQuery.ilike("name", `%${query}%`);
  }
  const { data: vendors } = await vendorsQuery.order("name", { ascending: sortDirection === "asc" }).returns<VendorRow[]>();

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
        {sortDirection === "desc" && <input type="hidden" name="sort" value="desc" />}
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Link
        href={buildHref({ sort: sortDirection === "asc" ? "desc" : "asc" })}
        className="self-start rounded-pill border-2 border-border bg-surface px-2.5 py-1 text-[11px] font-extrabold text-text-muted"
      >
        Name {sortDirection === "asc" ? "A → Z" : "Z → A"}
      </Link>

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

      <StaggerList className="flex flex-col gap-3">
        {vendors && vendors.length > 0 ? (
          vendors.map((vendor) => (
            <StaggerItem key={vendor.id}>
              {/* A plain Card, not LinkCard: the verification badge is a
                  real interactive button (tap to expand/collapse), and
                  nesting a <button> inside a <Link>'s <a> is invalid HTML —
                  so the vendor name/category is its own inner Link instead
                  of the whole row being one, letting the badge sit beside
                  it as a sibling. */}
              <Card className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/vendors/${vendor.id}`} className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-text">{vendor.name}</p>
                  {vendor.primary_category && (
                    <p className="text-xs font-semibold text-text-muted">{vendor.primary_category}</p>
                  )}
                </Link>
                <VerificationBadge verified={vendor.verification_status === "verified"} description={vendor.description} />
              </Card>
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No vendors match yet — check back soon.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
