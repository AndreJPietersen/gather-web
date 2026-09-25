import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request. Without this,
// a session nearing expiry could silently fail on the next Server Component
// render instead of refreshing transparently — this is what keeps the
// browser and server in sync on session state.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  // Do not add code between createServerClient and getUser() — this call is
  // what actually performs the refresh, and skipping it can cause random
  // logouts (see Supabase's Next.js SSR guide).
  await supabase.auth.getUser();

  return supabaseResponse;
}
