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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
