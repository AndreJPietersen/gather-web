import { createServiceClient } from "@/lib/supabase/service";

// When a pattern is unusual enough to show an admin. These only raise a
// warning on /admin/watchlist — nothing is blocked — so they're set at "worth
// a look", not "certainly abuse". Stored in app_settings (watch_* columns)
// and edited at /admin/settings; the SQL function takes them as parameters.
export interface WatchlistThresholds {
  listingDays: number;
  listingMin: number; // listings (own businesses + stubs) created by one person in listingDays
  teamMin: number; // active vendor-team seats held by one person, any role
  claimDays: number;
  claimMin: number; // claim requests by one person in claimDays
  inviteDays: number;
  inviteMin: number; // team invites sent by one person in inviteDays
  contactMin: number; // listings sharing one phone number or website
}

export const DEFAULT_WATCHLIST_THRESHOLDS: WatchlistThresholds = {
  listingDays: 7,
  listingMin: 5,
  teamMin: 8,
  claimDays: 30,
  claimMin: 3,
  inviteDays: 7,
  inviteMin: 15,
  contactMin: 3,
};

export async function getWatchlistThresholds(): Promise<WatchlistThresholds> {
  const service = createServiceClient();
  const { data } = await service
    .from("app_settings")
    .select("watch_listing_days, watch_listing_min, watch_team_min, watch_claim_days, watch_claim_min, watch_invite_days, watch_invite_min, watch_contact_min")
    .eq("id", true)
    .maybeSingle();
  if (!data) return DEFAULT_WATCHLIST_THRESHOLDS;
  return {
    listingDays: data.watch_listing_days,
    listingMin: data.watch_listing_min,
    teamMin: data.watch_team_min,
    claimDays: data.watch_claim_days,
    claimMin: data.watch_claim_min,
    inviteDays: data.watch_invite_days,
    inviteMin: data.watch_invite_min,
    contactMin: data.watch_contact_min,
  };
}

export type WatchlistSignal =
  | "listing_burst"
  | "team_seats"
  | "claim_spree"
  | "invite_flood"
  | "shared_contact";

export interface WatchlistRow {
  signal: WatchlistSignal;
  subject_key: string;
  subject_id: string | null;
  subject_label: string;
  hits: number;
  detail: string | null;
  vendor_ids: string[] | null;
}

export interface DismissedRow extends WatchlistRow {
  dismissalId: string;
  hitsAtDismissal: number;
  note: string | null;
}

export interface Watchlist {
  active: WatchlistRow[];
  dismissed: DismissedRow[];
}

interface DismissalRecord {
  id: string;
  signal: string;
  subject_key: string;
  hits_at_dismissal: number;
  note: string | null;
}

// An entry stays dismissed only while it hasn't grown since — a user who
// was "fine" at 6 listings shows up again at 7.
export function splitDismissed(rows: WatchlistRow[], dismissals: DismissalRecord[]): Watchlist {
  const byKey = new Map(dismissals.map((d) => [`${d.signal}:${d.subject_key}`, d]));
  const active: WatchlistRow[] = [];
  const dismissed: DismissedRow[] = [];
  for (const row of rows) {
    const d = byKey.get(`${row.signal}:${row.subject_key}`);
    if (d && row.hits <= d.hits_at_dismissal) {
      dismissed.push({ ...row, dismissalId: d.id, hitsAtDismissal: d.hits_at_dismissal, note: d.note });
    } else {
      active.push(row);
    }
  }
  return { active, dismissed };
}

export function signalInfo(t: WatchlistThresholds): Record<WatchlistSignal, { title: string; explain: string }> {
  return {
  listing_burst: {
    title: "Lots of new listings",
    explain: `${t.listingMin}+ listings created in the last ${t.listingDays} days (their own businesses and stubs).`,
  },
  team_seats: {
    title: "On many vendor teams",
    explain: `Active on ${t.teamMin}+ vendor teams — could be a set of look-alike businesses run by one person.`,
  },
  claim_spree: {
    title: "Claiming many listings",
    explain: `${t.claimMin}+ claim requests in the last ${t.claimDays} days.`,
  },
  invite_flood: {
    title: "Sending many team invites",
    explain: `${t.inviteMin}+ team invites in the last ${t.inviteDays} days.`,
  },
  shared_contact: {
    title: "Listings sharing contact details",
    explain: `${t.contactMin}+ listings with the same phone number or website.`,
  },
  };
}

export const SIGNAL_ORDER: WatchlistSignal[] = [
  "listing_burst",
  "shared_contact",
  "team_seats",
  "claim_spree",
  "invite_flood",
];

// Callers must already have passed requireAdmin() — this uses the service
// role, the only role allowed to execute admin_watchlist().
export async function getWatchlist(t: WatchlistThresholds): Promise<Watchlist> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_watchlist", {
    p_listing_days: t.listingDays,
    p_listing_min: t.listingMin,
    p_team_min: t.teamMin,
    p_claim_days: t.claimDays,
    p_claim_min: t.claimMin,
    p_invite_days: t.inviteDays,
    p_invite_min: t.inviteMin,
    p_contact_min: t.contactMin,
  });
  if (error) {
    console.error("admin_watchlist failed", error);
    return { active: [], dismissed: [] };
  }
  const { data: dismissals } = await service
    .from("admin_watchlist_dismissals")
    .select("id, signal, subject_key, hits_at_dismissal, note");
  const rows = ((data ?? []) as WatchlistRow[]).sort((a, b) => b.hits - a.hits);
  return splitDismissed(rows, (dismissals ?? []) as DismissalRecord[]);
}
