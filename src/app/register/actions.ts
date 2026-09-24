"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRegistrationEnabled } from "@/lib/app-settings";

const signUpSchema = z.object({
  email: z.string().trim().email("That doesn't look like a valid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  persona: z.enum(["planner", "vendor"]),
});

const REGISTRATION_CLOSED_MESSAGE = "Sign-ups are paused right now. Please check back soon.";

export interface SignUpState {
  error?: string;
}

// Redirects on every non-error outcome rather than returning state — same
// lesson as /login/actions.ts: signUp() sets an auth cookie on success,
// which makes Next reseed the client tree before useActionState's return
// value could be read. See teachAndre/03-server-actions-and-client-state.md.
export async function signUp(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    persona: formData.get("persona"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details and try again." };
  }

  const { email, password, persona } = parsed.data;

  if (!(await getRegistrationEnabled())) {
    return { error: REGISTRATION_CLOSED_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Local dev has email confirmations disabled, so signUp() returns a real
  // session immediately. A production config with confirmations enabled
  // would return a user but no session here — handle both rather than
  // assuming local behavior everywhere.
  if (!data.session) {
    redirect("/register/check-email");
  }

  redirect(persona === "vendor" ? "/onboarding/vendor" : "/onboarding/planner");
}
