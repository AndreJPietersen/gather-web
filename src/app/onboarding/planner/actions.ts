"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export interface OnboardingState {
  error?: string;
}

export async function completePlannerProfile(_prevState: OnboardingState, formData: FormData): Promise<OnboardingState> {
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

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.name, phone: parsed.data.phone || null })
    .eq("id", user.id);

  if (error) {
    return { error: "Something went wrong saving your profile. Please try again." };
  }

  // See onboarding/vendor/actions.ts's comment — this write doesn't mutate a
  // cookie either, so the root layout's session data (display_name) could
  // otherwise be served stale from the client Router Cache on redirect.
  revalidatePath("/", "layout");
  redirect("/");
}
