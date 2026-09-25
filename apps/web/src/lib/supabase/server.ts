import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Use this in Server Components, Server Actions, and Route Handlers. Each
// call reads the current request's cookies, so create a fresh client per
// request rather than reusing one across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which can't set cookies directly.
            // Safe to ignore because src/middleware.ts refreshes the session
            // on every request anyway.
          }
        },
      },
    },
  );
}
