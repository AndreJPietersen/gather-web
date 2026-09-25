import { createGatherClient, type GatherClient } from "@gather/db/client";
import { createClient as createCookieClient } from "@/lib/supabase/server";

// "Who is asking": the signed-in person plus a Supabase client that acts AS
// them, so row-level security still applies to everything a service does
// with it. Services that need more (the service role) say so explicitly by
// calling createServiceClient() themselves, after checking the caller.
export interface Caller {
  userId: string;
  email: string | null;
  supabase: GatherClient;
}

/** The website: the person's session is in the request's cookies. */
export async function callerFromCookies(): Promise<Caller | null> {
  const supabase = await createCookieClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null, supabase };
}

/** The native apps: "Authorization: Bearer <Supabase access token>". */
export async function callerFromBearer(request: Request): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const supabase = createGatherClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    accessToken: token,
  });
  // Ask the auth server, not just decode the token: a banned (suspended) or
  // deleted account's token must stop working immediately.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null, supabase };
}
