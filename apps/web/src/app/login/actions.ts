"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SignInState {
  error?: string;
}

// Redirects server-side on success rather than returning {success: true} for
// the client to act on: a Server Action that mutates cookies (this one sets
// the auth cookie) makes Next.js reseed the current route's client tree in
// the same response, which remounts useActionState's hook state before any
// client-side useEffect watching it can run. Redirecting inside the action
// sidesteps that entirely. The error path never mutates cookies, so
// useActionState's returned {error} reaches the client normally.
export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // A Supabase Auth ban is how an admin suspension locks someone out
    // (src/lib/admin/moderation.ts) — say so plainly instead of the raw
    // "User is banned".
    if (error.code === "user_banned") {
      return { error: "This account has been suspended. If you think that's a mistake, email support." };
    }
    return { error: error.message };
  }

  // Everyone has the Planner persona; any active vendor team membership adds
  // another, and then the first screen should ask which one they're here as.
  const { count } = await supabase
    .from("vendor_team_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .eq("is_active", true);

  redirect((count ?? 0) > 0 ? "/choose-persona" : "/");
}
