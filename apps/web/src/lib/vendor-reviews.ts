import type { createClient } from "@/lib/supabase/server";
import { getMyEventIds } from "@/lib/my-events";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RatingSummary {
  average: number;
  count: number;
  byStar: Record<1 | 2 | 3 | 4 | 5, number>;
}

const EMPTY_SUMMARY: RatingSummary = { average: 0, count: 0, byStar: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

// A plain `.eq("vendor_id", vendorId)` on vendor_reviews itself — not a
// join through event_vendors — deliberately: event_vendors is NOT public
// (only the booking's own event-side people or the vendor's team can see
// it), so a PostgREST embed like `vendor_reviews(...event_vendors(...))`
// would be subject to THAT table's RLS too and silently return nothing for
// anyone without a relationship to the specific booking — exactly the
// third-party planner just browsing a vendor's profile this feature exists
// for. See vendor_reviews.vendorId's own comment in schema.ts for the full
// story (a real bug, caught by Playwright, not assumed away). No stored
// average anywhere, though: computed fresh every call, the same "derive
// it, don't store a flag nothing maintains" reasoning already applied to
// vendor-completion's percent and installment overdue-ness.
export async function getVendorRatingSummary(supabase: SupabaseServerClient, vendorId: string): Promise<RatingSummary> {
  const { data } = await supabase.from("vendor_reviews").select("rating").eq("vendor_id", vendorId).returns<{ rating: number }[]>();

  const ratings = data ?? [];
  if (ratings.length === 0) return EMPTY_SUMMARY;

  const byStar: RatingSummary["byStar"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of ratings) {
    total += r.rating;
    byStar[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
  }

  return { average: total / ratings.length, count: ratings.length, byStar };
}

// The list-page equivalent of getVendorRatingSummary above — one flat
// query plus in-app aggregation for however many vendors are on screen
// (a card grid, a teaser row), rather than one query per card. Same "fetch
// once, reduce into a Map" shape as rankVendors' own gallery/service/social
// counts and getUnreadCounts, not an N+1 loop. Vendors with zero reviews
// simply have no entry in the returned Map — callers treat a missing key
// as "no rating yet" and skip rendering a badge, rather than rendering an
// empty 0.0/0-review one.
export async function getVendorRatingSummaries(
  supabase: SupabaseServerClient,
  vendorIds: string[],
): Promise<Map<string, RatingSummary>> {
  const map = new Map<string, RatingSummary>();
  if (vendorIds.length === 0) return map;

  const { data } = await supabase
    .from("vendor_reviews")
    .select("vendor_id, rating")
    .in("vendor_id", vendorIds)
    .returns<{ vendor_id: string; rating: number }[]>();

  const byVendor = new Map<string, number[]>();
  for (const row of data ?? []) {
    const list = byVendor.get(row.vendor_id) ?? [];
    list.push(row.rating);
    byVendor.set(row.vendor_id, list);
  }

  for (const [vendorId, ratings] of byVendor) {
    const byStar: RatingSummary["byStar"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    for (const r of ratings) {
      total += r;
      byStar[r as 1 | 2 | 3 | 4 | 5] += 1;
    }
    map.set(vendorId, { average: total / ratings.length, count: ratings.length, byStar });
  }

  return map;
}

export interface ReviewRow {
  id: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
  reviewerName: string;
  reply: { replyText: string; createdAt: string } | null;
}

interface ReviewQueryRow {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
  // A single nullable object, not an array — PostgREST infers a to-one
  // embed here because vendor_review_replies.vendor_review_id carries a
  // UNIQUE constraint (one reply per review), the opposite of every other
  // embed in this app (which are all genuine to-many).
  vendor_review_replies: { reply_text: string; created_at: string } | null;
}

// Shared by the public vendor profile's teaser (limited), the full
// "See all reviews" list, and the vendor's own dashboard — one query shape,
// one reviewer-name fallback, so all three surfaces read identically.
export async function getVendorReviews(
  supabase: SupabaseServerClient,
  vendorId: string,
  limit?: number,
): Promise<ReviewRow[]> {
  let query = supabase
    .from("vendor_reviews")
    .select(
      "id, rating, review_text, created_at, profiles!vendor_reviews_reviewer_id_profiles_id_fk(display_name), vendor_review_replies(reply_text, created_at)",
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data } = await query.returns<ReviewQueryRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    rating: row.rating,
    reviewText: row.review_text,
    createdAt: row.created_at,
    reviewerName: row.profiles?.display_name ?? "A planner",
    reply: row.vendor_review_replies
      ? { replyText: row.vendor_review_replies.reply_text, createdAt: row.vendor_review_replies.created_at }
      : null,
  }));
}

export interface EligibleBooking {
  eventVendorId: string;
  eventName: string;
  existingReview: { rating: number; reviewText: string | null } | null;
}

// The booking a "Write a review" CTA should point at: the most recent
// contracted booking this planner (owner or any accepted collaborator, not
// just an editor — matching vendor_reviews_insert_self's own RLS check)
// has with this vendor. Prefers one with no review yet; if every eligible
// booking already has one, falls back to the most recent of those so the
// CTA becomes "edit" instead — deliberately not a multi-booking chooser,
// since picking one sensible default beats building UI for a rare case.
export async function getEligibleBookingForReview(
  supabase: SupabaseServerClient,
  vendorId: string,
  userId: string,
): Promise<EligibleBooking | null> {
  const myEventIds = await getMyEventIds(supabase, userId);
  if (myEventIds.size === 0) return null;

  const { data: bookings } = await supabase
    .from("event_vendors")
    .select("id, event_id, events(name)")
    .eq("vendor_id", vendorId)
    .eq("status", "contracted")
    .order("created_at", { ascending: false })
    .returns<{ id: string; event_id: string; events: { name: string } | null }[]>();

  const eligible = (bookings ?? []).filter((b) => myEventIds.has(b.event_id));
  if (eligible.length === 0) return null;

  const { data: existingReviews } = await supabase
    .from("vendor_reviews")
    .select("event_vendor_id, rating, review_text")
    .eq("reviewer_id", userId)
    .in(
      "event_vendor_id",
      eligible.map((b) => b.id),
    )
    .returns<{ event_vendor_id: string; rating: number; review_text: string | null }[]>();

  const reviewByBooking = new Map((existingReviews ?? []).map((r) => [r.event_vendor_id, r]));
  const target = eligible.find((b) => !reviewByBooking.has(b.id)) ?? eligible[0];
  const existing = reviewByBooking.get(target.id);

  return {
    eventVendorId: target.id,
    eventName: target.events?.name ?? "your event",
    existingReview: existing ? { rating: existing.rating, reviewText: existing.review_text } : null,
  };
}
