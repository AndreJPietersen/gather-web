import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** A Supabase client that knows every Gather table, column and function. */
export type GatherClient = SupabaseClient<Database>;

export interface GatherClientOptions {
  url: string;
  /** The public anon key (or publishable key). Safe to ship in an app: row-level security does the protecting. */
  anonKey: string;
  /**
   * Where the login session is kept. Leave out on the web server. The mobile
   * app passes an adapter over expo-secure-store (getItem/setItem/removeItem),
   * so the session lives in the phone's secure keychain, not plain storage.
   */
  storage?: SupportedStorage;
  /** Act as this person for a single request instead of holding a session (used by servers with a bearer token). */
  accessToken?: string;
  /** Native apps have no URL to read a session from; set false there. Default true in browsers. */
  detectSessionInUrl?: boolean;
}

/**
 * The one way to make a plain (non-cookie) Gather Supabase client — for the
 * mobile app, scripts and server code acting on a bearer token. The website's
 * cookie-based clients (`@supabase/ssr`) use the same `Database` type; see
 * apps/web/src/lib/supabase.
 */
export function createGatherClient(options: GatherClientOptions): GatherClient {
  const { url, anonKey, storage, accessToken, detectSessionInUrl } = options;
  return createClient<Database>(url, anonKey, {
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
    auth: {
      persistSession: accessToken ? false : true,
      autoRefreshToken: accessToken ? false : true,
      ...(storage ? { storage } : {}),
      ...(detectSessionInUrl !== undefined ? { detectSessionInUrl } : {}),
    },
  });
}
