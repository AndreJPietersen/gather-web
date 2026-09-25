"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface ResetPasswordState {
  error?: string;
}

const schema = z.string().min(8, "Password must be at least 8 characters").max(72);

// Only works for someone who arrived through a reset link (which gave them a
// session in /auth/confirm); without a session there is nothing to update.
export async function setNewPassword(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = schema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message };
  redirect("/");
}
