import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../../access";
import { AddSocialLinkForm } from "../add-social-link-form";
import { removeSocialLink } from "../actions";

interface SocialLinkRow {
  id: string;
  platform: string;
  url: string;
}

export default async function VendorSocialLinksPage({ params }: PageProps<"/vendor/[vendorId]/dashboard/social-links">) {
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
  const isVerified = vendor.verification_status === "verified";

  const { data: socialLinks } = await supabase
    .from("vendor_social_links")
    .select("id, platform, url")
    .eq("vendor_id", vendorId)
    .returns<SocialLinkRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Social Links">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
      </PageHeader>

      <StaggerList className="flex flex-col gap-2">
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

      {canQuote &&
        (isVerified ? (
          <AddSocialLinkForm vendorId={vendorId} />
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">
              Social links are only available to verified vendors — claim and verify this listing first.
            </p>
          </Card>
        ))}
    </main>
  );
}
