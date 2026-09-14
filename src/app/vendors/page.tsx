import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const { q, category } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const activeCategory = typeof category === "string" ? category : "";

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
  const { data: vendors } = await vendorsQuery.order("name", { ascending: true }).returns<VendorRow[]>();

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
            href={query ? `/vendors?q=${encodeURIComponent(query)}` : "/vendors"}
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
              href={`/vendors?category=${encodeURIComponent(cat)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
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

      <div className="flex flex-col gap-3">
        {vendors && vendors.length > 0 ? (
          vendors.map((vendor) => (
            <Link key={vendor.id} href={`/vendors/${vendor.id}`}>
              <Card className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-text">{vendor.name}</p>
                  <span
                    className={cn(
                      "rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase",
                      vendor.verification_status === "verified" ? "bg-success-soft text-ink" : "bg-secondary-soft text-ink",
                    )}
                  >
                    {vendor.verification_status === "verified" ? "Verified" : "Unverified"}
                  </span>
                </div>
                {vendor.primary_category && (
                  <p className="text-xs font-semibold text-text-muted">{vendor.primary_category}</p>
                )}
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No vendors match yet — check back soon.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
