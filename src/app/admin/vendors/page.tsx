import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, LinkCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";

interface VendorRow {
  id: string;
  name: string;
  primary_category: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  is_featured: boolean;
  created_at: string;
}

const statusClasses: Record<VendorRow["verification_status"], string> = {
  unclaimed: "bg-surface text-text-muted border-2 border-border",
  claim_pending: "bg-secondary-soft text-ink",
  verified: "bg-success-soft text-ink",
};

export default async function AdminVendorsPage({ searchParams }: PageProps<"/admin/vendors">) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const service = createServiceClient();
  let vendorsQuery = service.from("vendors").select("id, name, primary_category, verification_status, is_featured, created_at");
  if (query) {
    vendorsQuery = vendorsQuery.ilike("name", `%${query}%`);
  }
  const { data: vendors } = await vendorsQuery
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<VendorRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Vendors</h1>
        <LinkButton href="/admin/vendors/claims" variant="secondary">
          Claim Queue
        </LinkButton>
      </div>

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Search by name" className="max-w-xs" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {vendors && vendors.length > 0 ? (
          vendors.map((vendor) => (
            <LinkCard key={vendor.id} href={`/admin/vendors/${vendor.id}`} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text">
                  {vendor.is_featured && <span title="Featured">★ </span>}
                  {vendor.name}
                </p>
                {vendor.primary_category && (
                  <p className="text-xs font-semibold text-text-muted">{vendor.primary_category}</p>
                )}
              </div>
              <span
                className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusClasses[vendor.verification_status]}`}
              >
                {vendor.verification_status.replace("_", " ")}
              </span>
            </LinkCard>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No vendors match.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
