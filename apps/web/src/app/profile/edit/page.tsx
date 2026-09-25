import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionContext } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/service";
import { EditProfileForm } from "./edit-profile-form";

// The only place to fix your name/phone after onboarding — before this,
// onboarding's own form was a one-time thing with no way back to it.
export default async function EditProfilePage() {
  const session = await getSessionContext();
  if (session.status !== "authenticated") {
    redirect("/login");
  }

  // Phone numbers aren't readable through the public API any more (column
  // grants, migration 0049 — they were visible to anyone), so the user's own
  // row is read server-side with the service role, pinned to their own id.
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("display_name, phone")
    .eq("id", session.userId)
    .maybeSingle<{ display_name: string | null; phone: string | null }>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Edit Profile" />
      <EditProfileForm name={profile?.display_name ?? ""} phone={profile?.phone ?? ""} />
    </main>
  );
}
