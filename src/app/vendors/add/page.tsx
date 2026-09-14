import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { VerificationBadge } from "@/components/vendor/verification-badge";
import { createClient } from "@/lib/supabase/server";
import { CreateStubForm } from "./create-stub-form";

interface VendorSearchResult {
  id: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
}

// Search-first, per the dedupe-before-create business rule (see
// docs/gather_web_architecture.md's Business Rules & Invariants) — the
// create-stub form only ever renders once a search has actually been tried,
// rather than being available up front.
export default async function AddVendorPage({ searchParams }: PageProps<"/vendors/add">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  let results: VendorSearchResult[] = [];
  if (query) {
    const { data } = await supabase
      .from("vendors")
      .select("id, name, primary_category, description, verification_status")
      .ilike("name", `%${query}%`)
      .limit(10)
      .returns<VendorSearchResult[]>();
    results = data ?? [];
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Add a Vendor</h1>
          <p className="mt-1 text-sm font-semibold text-text-muted">
            Search first to make sure they&apos;re not already listed.
          </p>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Vendor name" className="flex-1" required />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {query && (
        <>
          <StaggerList className="flex flex-col gap-2">
            {results.length > 0 ? (
              results.map((vendor) => (
                <StaggerItem key={vendor.id}>
                  {/* Plain Card + inner Link, not LinkCard — see vendors/page.tsx
                      for why: the badge is a real button, and a button can't
                      nest inside a Link's <a>. */}
                  <Card className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/vendors/${vendor.id}`} className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text">{vendor.name}</p>
                    </Link>
                    <VerificationBadge verified={vendor.verification_status === "verified"} description={vendor.description} />
                  </Card>
                </StaggerItem>
              ))
            ) : (
              <Card>
                <p className="text-sm font-semibold text-text-muted">No matches for &quot;{query}&quot;.</p>
              </Card>
            )}
          </StaggerList>

          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Not listed? Add them</h2>
            <p className="mt-1 text-sm font-semibold text-text-muted">
              They&apos;ll show up as Unverified until the real business claims this listing.
            </p>
            <div className="mt-3">
              <CreateStubForm prefillName={query} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
