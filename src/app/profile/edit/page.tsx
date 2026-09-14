import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "./edit-profile-form";

// The only place to fix your name/phone after onboarding — before this,
// onboarding's own form was a one-time thing with no way back to it.
export default async function EditProfilePage() {
  const session = await getSessionContext();
  if (session.status !== "authenticated") {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("id", session.userId)
    .maybeSingle<{ display_name: string | null; phone: string | null }>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink">Edit Profile</h1>
      </div>
      <EditProfileForm name={profile?.display_name ?? ""} phone={profile?.phone ?? ""} />
    </main>
  );
}
