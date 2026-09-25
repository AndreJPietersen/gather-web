"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface ForgotPasswordState {
  error?: string;
  sent?: boolean;
}

const schema = z.string().trim().email("That doesn't look like a valid email").max(200);

// Always answers "sent" for a well-formed address, whether or not an account
// exists, so this form can't be used to find out who has an account.
export async function requestPasswordReset(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const origin = (await headers()).get("origin") ?? process.env.EMAIL_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  return { sent: true };
}
