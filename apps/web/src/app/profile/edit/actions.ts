"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export interface EditProfileState {
  error?: string;
}

// Same shape as onboarding/planner's completePlannerProfile — the only
// difference is this can be reached again after that first save, since
// there was previously no way back to it at all.
export async function updateProfile(_prevState: EditProfileState, formData: FormData): Promise<EditProfileState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // .select("id").single() errors on zero rows — which is exactly what
  // happens if RLS (profiles_update_own) silently filtered out an
  // unauthorized update, so this doubles as the authorization check, same
  // idiom as updateEvent.
  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.name, phone: parsed.data.phone || null })
    .eq("id", user.id)
    .select("id")
    .single();

  if (error || !profile) {
    return { error: "Something went wrong saving your profile. Please try again." };
  }

  // display_name is read by the root layout (tab bar / greeting) and by
  // this same Profile page's "Signed in as ..." line — this write doesn't
  // mutate a cookie, so it doesn't get Next's automatic "cookie mutation
  // re-renders the page" treatment, and without this the layout could
  // still serve the old name from the client Router Cache after redirect
  // (the same gotcha onboarding's own save already had to work around).
  revalidatePath("/", "layout");
  redirect("/profile");
}
