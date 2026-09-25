import type { Database } from "@gather/db/database.types";
import { createBrowserClient } from "@supabase/ssr";

// Use this in Client Components ("use client"). Reads the public URL/anon
// key — safe to expose to the browser; RLS policies are what actually
// enforce access, not this key.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
