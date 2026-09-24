import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  pgPolicy,
  index,
  uniqueIndex,
  primaryKey,
  check,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  numeric,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { authUid, authenticatedRole, anonRole } from "drizzle-orm/supabase";

// See docs/gather_web_architecture.md ("Data Model Port" and "Authorization
// Model Port" sections) for the Salesforce-object-to-table mapping and the
// reasoning behind each RLS policy below. Every table has RLS turned on via
// .enableRLS() — the safe-by-default posture equivalent to Salesforce's
// Private OWD, deny-by-default until a policy explicitly grants access.
// Only events/vendors/event_collaborators/vendor_team_members/event_vendors
// have real policies so far (this is Phase 0's "baseline" scope per the
// architecture doc); every other table is intentionally locked down to
// service-role-only access until its owning feature phase adds policies.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled"]);
export const eventVisibilityEnum = pgEnum("event_visibility", ["public", "private", "invite_only"]);
export const collaboratorPermissionEnum = pgEnum("collaborator_permission", ["editor", "viewer"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["invited", "accepted", "declined"]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["attending", "declined", "maybe", "no_response"]);
export const vendorVerificationStatusEnum = pgEnum("vendor_verification_status", [
  "unclaimed",
  "claim_pending",
  "verified",
]);
export const eventVendorStatusEnum = pgEnum("event_vendor_status", [
  "interested",
  "shortlisted",
  "contracted",
  "rejected",
]);
export const featurePlacementStatusEnum = pgEnum("feature_placement_status", ["pending", "activated", "cancelled"]);
export const claimRequestStatusEnum = pgEnum("claim_request_status", ["pending", "approved", "rejected"]);
export const vendorRoleEnum = pgEnum("vendor_role", ["owner", "manager", "staff"]);
export const vendorQuoteStatusEnum = pgEnum("vendor_quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);
export const paymentPlanStatusEnum = pgEnum("payment_plan_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
]);
export const installmentStatusEnum = pgEnum("installment_status", ["pending", "paid", "late", "cancelled", "refunded"]);
export const reminderMethodEnum = pgEnum("reminder_method", ["email", "sms", "push"]);
// How far ahead of a task/installment's due_date it starts counting as
// "upcoming" on Home and the per-event indicators — a display-filtering
// preference, distinct from (and not blocked on) the actual reminder-
// sending infrastructure notificationPreferences below is otherwise about,
// which still has no background-job scheduler chosen (see Outstanding
// Items). This only ever affects what a user sees when they open the app.
export const upcomingWindowEnum = pgEnum("upcoming_window", ["on_day", "one_day_before", "one_week_before"]);
export const supportCaseStatusEnum = pgEnum("support_case_status", ["open", "pending", "resolved", "closed"]);
export const supportCasePriorityEnum = pgEnum("support_case_priority", ["low", "normal", "high", "urgent"]);
// The self-service "Report an Issue" form's category dropdown — grounded in
// the actual features shipped so far (payments/installments, vendor quotes/
// booking/chat, event/RSVP/budget/tasks, profile/vendor verification),
// rather than a generic helpdesk taxonomy. Nullable on the table itself
// (below) since the admin-logged path predates this and has no category to
// backfill.
export const supportCaseCategoryEnum = pgEnum("support_case_category", [
  "payments_billing",
  "vendor_booking",
  "event_setup",
  "account_verification",
  "app_bug",
  "other",
]);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

// Matches Supabase Auth's auth.users.id 1:1 — one row per signed-up user,
// created via a trigger on auth.users (see Phase 4 / Supabase Auth setup).
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    displayName: text("display_name"),
    phone: text("phone"),
    // Phase 10 — a capability layered on top of whichever persona(s) this
    // user already has, not a persona itself (no "Admin" entry in the
    // switcher). Flipped by hand in Supabase Studio only, never exposed in
    // the product UI. Never read directly by app code — always through the
    // is_admin() SECURITY DEFINER function (see supabase/migrations), since
    // profiles_select_all_authenticated below grants full-row SELECT to any
    // signed-in or anonymous request, which would make a plain column
    // publicly queryable.
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  () => [
    pgPolicy("profiles_select_all_authenticated", {
      for: "select",
      to: [authenticatedRole, anonRole],
      using: sql`true`,
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`id = ${authUid}`,
    }),
  ],
).enableRLS();

// Phase 9 — never existed before now ("Notifications & Reminders" was an
// honest "coming soon" placeholder on Profile with no backing object at
// all, per the Salesforce build's own gatherProfile). One row per user,
// created lazily (upserted) the first time they save preferences rather
// than via a signup trigger — avoids touching the already-applied
// profiles-on-signup migration (see teachAndre/05 on why that's off
// limits). SMS/push default to false and stay unofferable in the UI: the
// Salesforce build's NotificationSender family deliberately failed loudly
// on those channels rather than pretend to send, since they were never
// actually implemented — same honesty carried forward here.
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    profileId: uuid("profile_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
    emailReminders: boolean("email_reminders").notNull().default(true),
    smsReminders: boolean("sms_reminders").notNull().default(false),
    pushReminders: boolean("push_reminders").notNull().default(false),
    // Default is the most generous window (a week), not the narrowest — a
    // new user should see their upcoming tasks/payments without having to
    // discover and tighten a setting first; someone who finds a week's
    // notice too noisy can narrow it themselves.
    upcomingWindow: upcomingWindowEnum("upcoming_window").notNull().default("one_week_before"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy("notification_preferences_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.profileId} = ${authUid}`,
    }),
    pgPolicy("notification_preferences_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.profileId} = ${authUid}`,
    }),
    pgPolicy("notification_preferences_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.profileId} = ${authUid}`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// An admin-managed lookup list (Wedding, Birthday, Corporate, ...) — the
// dropdown events.event_type used to be free text. Public read (any
// signed-in planner needs the live list to populate the create/edit-event
// dropdown); no insert/update/delete policy at all, since every write goes
// through the admin console's service-role client, the same posture as
// every other admin-owned table in this file.
export const eventTypes = pgTable(
  "event_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_types_name_unique").on(table.name),
    pgPolicy("event_types_select_all", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
).enableRLS();

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id),
    name: text("name").notNull(),
    eventType: text("event_type"),
    // Kept alongside the free-text eventType column above rather than
    // replacing it: a real picked type copies its current name into
    // eventType (so every existing display path keeps working with zero
    // joins) and sets this id; picking "Other" leaves this null and stores
    // the custom text in eventType instead. onDelete: "set null" — removing
    // an event type from the admin list must never touch a planner's
    // already-created event, only stop it being offered as a new choice.
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
    status: eventStatusEnum("status").notNull().default("draft"),
    visibility: eventVisibilityEnum("visibility").notNull().default("private"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    // Optional — a date, not a timestamptz, matching payment_plans.deposit_
    // due_date's own "just a day, no meaningful time-of-day" treatment.
    // Drives two things on the Attendees page: a countdown pill while it's
    // still upcoming, and the headline number switching from "invited" to
    // "attending" once it's passed (see isDateOverdue in lib/upcoming.ts).
    rsvpDate: date("rsvp_date"),
    location: text("location"),
    description: text("description"),
    capacity: integer("capacity"),
    // Both optional, same "nullable, no forced default" treatment as
    // capacity above. budgetWarningPercent null means "use the app's
    // default" (DEFAULT_BUDGET_WARNING_PERCENT in
    // src/app/events/budget-constants.ts) rather than a stored 90 on every
    // event that never set one explicitly.
    budgetTotal: numeric("budget_total", { precision: 12, scale: 2 }),
    budgetWarningPercent: integer("budget_warning_percent"),
    coverImageUrl: text("cover_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // RLS policies below constantly filter/join on owner_id — index it.
    index("events_owner_id_idx").on(table.ownerId),
    index("events_event_type_id_idx").on(table.eventTypeId),
    // Guest/public: only published + public events are visible with no auth at all —
    // the direct replacement for the Guest User Sharing Rule, minus the async
    // recalculation lag Salesforce required.
    pgPolicy("events_select_public", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.status} = 'published' AND ${table.visibility} = 'public'`,
    }),
    // Owner or an accepted collaborator (any permission level) can see the
    // event regardless of status/visibility — direct port of EventSharingManager's
    // explicit-grant-on-invite-accept pattern.
    pgPolicy("events_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.ownerId} = ${authUid} OR public.is_event_collaborator(${table.id}, ${authUid})`,
    }),
    // Phase 5 gap found building collaborator invites: is_event_collaborator
    // only matches an *accepted* collaboration, so a pending invitee could
    // see their own event_collaborators row but not the event it points to
    // — hiding the very name/date/location a Profile "Accept/Decline" card
    // needs to show. The Salesforce build hit this identical gap building
    // the equivalent screen. See is_event_pending_invitee's own migration
    // comment (supabase/migrations/00000000000004_...) for the full story.
    pgPolicy("events_select_pending_invitee", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_pending_invitee(${table.id}, ${authUid})`,
    }),
    // Gap found building the event-vendor chat feature: event_vendors
    // itself already has a vendor-side SELECT branch
    // (event_vendors_select_event_side_or_vendor_side), but events never
    // did — so a vendor team member could see their own booking row while
    // the event it points to stayed invisible for anything short of
    // public+published (i.e. every real draft/private event mid-planning,
    // which is most of them). This silently broke the vendor dashboard's
    // own existing "events(name, start_at)" embed on its bookings list
    // long before chat needed the same data — confirmed live via a real
    // Playwright pass, not just by reading the policy list. Any active
    // team member, no role filter, matching event_vendors' own vendor-side
    // condition exactly (read access, not a management action).
    pgPolicy("events_select_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.event_id = ${table.id} AND public.is_vendor_team_member(ev.vendor_id, ${authUid})
      )`,
    }),
    pgPolicy("events_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.ownerId} = ${authUid}`,
    }),
    // Owner or an accepted Editor collaborator may edit — Viewers cannot.
    pgPolicy("events_update_owner_or_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.ownerId} = ${authUid} OR public.is_event_collaborator(${table.id}, ${authUid}, 'editor')`,
    }),
    pgPolicy("events_delete_owner", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.ownerId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const eventCollaborators = pgTable(
  "event_collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    permissionLevel: collaboratorPermissionEnum("permission_level").notNull().default("viewer"),
    status: invitationStatusEnum("status").notNull().default("invited"),
    invitedBy: uuid("invited_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_collaborators_event_id_idx").on(table.eventId),
    index("event_collaborators_user_id_idx").on(table.userId),
    // Visible to the invited user themselves, or to the event's owner (so the
    // owner can see who they've invited and manage the list).
    pgPolicy("event_collaborators_select_self_or_event_owner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR public.is_event_owner(${table.eventId}, ${authUid})`,
    }),
    // Gap found building the event-vendor chat feature, mirroring
    // vendor_team_members_select_event_side below it in this same file: a
    // vendor team member viewing a booking's chat needs to resolve "who is
    // this event-side sender" (the owner, or any collaborator) to a
    // display name, which means reading this table — but a vendor team
    // member is neither that row's own user nor the event owner, so this
    // stayed silently empty for them under the policy above alone. Scoped
    // to events this vendor actually has a real booking with, not blanket
    // visibility into any event's collaborator list.
    pgPolicy("event_collaborators_select_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.event_id = ${table.eventId} AND public.is_vendor_team_member(ev.vendor_id, ${authUid})
      )`,
    }),
    // Only the event owner or an existing accepted Editor may invite others.
    pgPolicy("event_collaborators_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    // The invited user can accept/decline their own invite; the event owner
    // can update rows (e.g. change permission level, revoke) at any time.
    pgPolicy("event_collaborators_update_self_or_event_owner", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR public.is_event_owner(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("event_collaborators_delete_event_owner", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid})`,
    }),
  ],
).enableRLS();

// Phase 5 adds real policies (was service-role-only since Phase 0). Same
// owner-or-accepted-collaborator shape as `events` itself: any accepted
// collaborator (Editor or Viewer) may read; only the owner or an Editor
// collaborator may write — matching `events_update_owner_or_editor`.
export const eventAttendees = pgTable(
  "event_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    contactUserId: uuid("contact_user_id").references(() => profiles.id),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    rsvpStatus: rsvpStatusEnum("rsvp_status").notNull().default("no_response"),
    guestCount: integer("guest_count").notNull().default(1),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_attendees_event_id_idx").on(table.eventId),
    pgPolicy("event_attendees_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("event_attendees_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_attendees_update_owner_or_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_attendees_delete_owner_or_editor", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
  ],
).enableRLS();

export const eventTasks = pgTable(
  "event_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    completed: boolean("completed").notNull().default(false),
    priority: text("priority"),
    assignedTo: uuid("assigned_to").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_tasks_event_id_idx").on(table.eventId),
    pgPolicy("event_tasks_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("event_tasks_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_tasks_update_owner_or_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_tasks_delete_owner_or_editor", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
  ],
).enableRLS();

// A per-event mood board — ideas/references the planner (or an editor
// collaborator) collects while planning, not a public-facing gallery like
// the vendor one below. The bytes live in the "event-gallery" Storage
// bucket, deliberately created *private* (unlike vendor-gallery) since this
// is personal planning content, not marketing material — display requires
// a signed URL generated server-side per request, not a permanent public
// one. Same owner-or-collaborator shape as every other event-scoped table.
export const eventGalleryImages = pgTable(
  "event_gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    caption: text("caption"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_gallery_images_event_id_idx").on(table.eventId),
    pgPolicy("event_gallery_images_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("event_gallery_images_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_gallery_images_delete_owner_or_editor", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
  ],
).enableRLS();

// A per-event mood board — the expressive, single-page companion to the
// plain event_gallery_images grid above, deliberately kept as its own
// separate feature rather than retrofitting Gallery into this (Andre's own
// call — see docs/gather_web_architecture.md's mood-board entry for the
// full discussion). One row per event, created lazily on first save rather
// than backfilled for every existing event — an event with no board row
// yet is a legitimate, common "nothing set up" state, not an error.
export const eventMoodBoards = pgTable(
  "event_mood_boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .unique()
      .references(() => events.id, { onDelete: "cascade" }),
    tagline: text("tagline"),
    // Hex strings ("#b25a28"), planner-entered via a plain color input —
    // never derived from the photos below and never tied to the app's own
    // Bold Playful/Ocean Current/Sunset Social themes, a deliberate call
    // from the architecture discussion ("pure expression, no app tie-in").
    palette: jsonb("palette").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy("event_mood_boards_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("event_mood_boards_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_mood_boards_update_owner_or_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
  ],
).enableRLS();

// The featured-pair-plus-grid photos themselves — same shape as
// event_gallery_images (private bucket, signed URLs, owner-or-editor
// write) with one addition: isFeatured/featuredAt, which the "fan" reads
// as its top-2-by-featuredAt. Capped at 2 true rows per event by the
// toggle action itself (un-featuring the oldest when a 3rd is starred),
// not a DB constraint — the same kind of soft, app-level cap
// MAX_GALLERY_IMAGES already uses rather than a CHECK.
export const eventMoodBoardPhotos = pgTable(
  "event_mood_board_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredAt: timestamp("featured_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_mood_board_photos_event_id_idx").on(table.eventId),
    pgPolicy("event_mood_board_photos_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("event_mood_board_photos_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_mood_board_photos_update_owner_or_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("event_mood_board_photos_delete_owner_or_editor", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    primaryCategory: text("primary_category"),
    description: text("description"),
    phone: text("phone"),
    website: text("website"),
    verificationStatus: vendorVerificationStatusEnum("verification_status").notNull().default("unclaimed"),
    // A dedicated "storefront photo," separate from the gallery — one
    // deliberate image a vendor sets, shown everywhere the vendor is listed
    // (Home's teaser, the /vendors marketplace, their own profile), unlike
    // vendor_gallery_images which is a whole album. Same owner/manager
    // write access as name/description/phone/website (no verified-gate,
    // unlike the gallery bucket) — a brand-new, not-yet-verified vendor
    // should still be able to work on their profile completion score.
    logoPath: text("logo_path"),
    // Featured status is no longer a column here — it lives in
    // vendor_feature_placements (dates, status, rank) and reaches queries as
    // the computed columns is_featured / featured_rank on vendors, defined in
    // the vendor_featured_functions migration. Vendors still cannot influence
    // it: nothing they can write touches vendor_feature_placements at all.
    createdBy: uuid("created_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendors_created_by_idx").on(table.createdBy),
    // Phase 6 widens this from "verified only" to all three current
    // statuses — the documented Vendor Directory Bootstrapping workflow
    // (gather_web_architecture.md) calls for unclaimed/claim_pending stubs
    // to appear in the public directory too, marked Unverified, which is
    // what makes the crowd-sourced model useful before real vendors arrive.
    // Flagged as a dormant gap back in Phase 3 (nothing could create a stub
    // until this phase); resolved now rather than left dormant further.
    // Listed explicitly rather than `true` so a future status value (e.g.
    // an admin-only "suspended") doesn't become public by default — it
    // would need adding here deliberately.
    pgPolicy("vendors_select_public_or_own", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.verificationStatus} IN ('verified', 'unclaimed', 'claim_pending') OR ${table.createdBy} = ${authUid} OR public.is_vendor_team_member(${table.id}, ${authUid})`,
    }),
    // Any authenticated user can create a vendor (self-registration, or a
    // planner's "stub" vendor) as long as they're recorded as its creator.
    pgPolicy("vendors_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.createdBy} = ${authUid}`,
    }),
    // Stub creator may edit until claimed; once verified, only Owner/Manager
    // team members may edit — mirrors VendorService.getOwnedOrManagedVendor.
    pgPolicy("vendors_update_creator_stub_or_owner_manager", {
      for: "update",
      to: authenticatedRole,
      using: sql`(${table.verificationStatus} = 'unclaimed' AND ${table.createdBy} = ${authUid}) OR public.is_vendor_team_member(${table.id}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
  ],
).enableRLS();

// An admin-managed lookup list (Photography, Catering, Music, Cakes, ...) —
// a different taxonomy from event_types above, not the same list: one
// event type needs several service categories at once (a Wedding needs
// music AND catering AND photography), so this can't just reuse event_types.
// Same public-read / admin-service-role-write posture.
export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("service_categories_name_unique").on(table.name),
    pgPolicy("service_categories_select_all", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
).enableRLS();

// This project's first true many-to-many junction table — admin-managed,
// answering "which service categories are typically relevant to this event
// type" (e.g. Wedding -> Music, Catering, Photography, Cakes), which is
// what powers the "Suggested Vendors" feature on an event's vendors page.
// A composite primary key on the pair, not a surrogate id: this row carries
// no payload beyond the pair itself, and every write (link/unlink from the
// admin mapping page) already has both ids in hand. onDelete: "cascade" on
// both sides is a safety net, not a feature in its own right — deleting an
// event type or category isn't an exposed admin action (only
// deactivate/reactivate is), so this just prevents orphaned mapping rows if
// that ever changes.
export const eventTypeServiceCategories = pgTable(
  "event_type_service_categories",
  {
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    serviceCategoryId: uuid("service_category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventTypeId, table.serviceCategoryId] }),
    index("event_type_service_categories_service_category_id_idx").on(table.serviceCategoryId),
    pgPolicy("event_type_service_categories_select_all", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
  ],
).enableRLS();

// Phase 6 adds real policies (was service-role-only since Phase 0). No UI
// manages these yet — that's Phase 8's vendor dashboard — but the data
// layer is ready ahead of it, same as event_attendees/event_tasks in
// Phase 5.
export const vendorServices = pgTable(
  "vendor_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Nullable, no backfill for pre-existing rows (same tolerance this
    // project already has for other nullable additive columns, e.g.
    // vendor_gallery_images.caption) — new services are required to pick
    // one at the form/zod layer, not enforced here at the DB layer.
    categoryId: uuid("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
  },
  (table) => [
    index("vendor_services_vendor_id_idx").on(table.vendorId),
    index("vendor_services_category_id_idx").on(table.categoryId),
    // A service listing is part of a vendor's public profile — same
    // visibility as the vendor itself, no separate condition needed.
    pgPolicy("vendor_services_select_public", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy("vendor_services_insert_owner_or_manager", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
    pgPolicy("vendor_services_update_owner_or_manager", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
    pgPolicy("vendor_services_delete_owner_or_manager", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
  ],
).enableRLS();

// Freeform platform label (not an enum) — "other social media tags" was the
// actual ask, and a vendor typing "TikTok" or "Threads" shouldn't need a
// schema migration to be supported. No UPDATE policy: changing a link is
// delete-and-re-add, which is simple enough not to need an edit form.
// INSERT is deliberately gated on the vendor already being verified — an
// unclaimed/community-submitted stub shouldn't be able to accumulate
// external links before anyone has confirmed who actually controls it.
export const vendorSocialLinks = pgTable(
  "vendor_social_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_social_links_vendor_id_idx").on(table.vendorId),
    pgPolicy("vendor_social_links_select_public", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy("vendor_social_links_insert_owner_or_manager_if_verified", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])
        AND public.is_vendor_verified(${table.vendorId})
      `,
    }),
    pgPolicy("vendor_social_links_delete_owner_or_manager", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
  ],
).enableRLS();

// Row per uploaded photo — the actual bytes live in the "vendor-gallery"
// Supabase Storage bucket (public, since a vendor's gallery is marketing
// content meant to be seen by anyone browsing the directory), this table
// just indexes them. `storage_path` is the object path within that bucket
// (`{vendorId}/{uuid}.{ext}`), matched against the storage.objects RLS
// policies in supabase/migrations by parsing that same vendorId out of the
// path — see that migration's own comment for why the two layers (this
// table's RLS, and storage.objects' own RLS) both need the same verified-
// only gate on INSERT independently; neither one alone protects the other.
export const vendorGalleryImages = pgTable(
  "vendor_gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    caption: text("caption"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_gallery_images_vendor_id_idx").on(table.vendorId),
    pgPolicy("vendor_gallery_images_select_public", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`true`,
    }),
    pgPolicy("vendor_gallery_images_insert_owner_or_manager_if_verified", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])
        AND public.is_vendor_verified(${table.vendorId})
      `,
    }),
    pgPolicy("vendor_gallery_images_delete_owner_or_manager", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
  ],
).enableRLS();

export const vendorClaimRequests = pgTable(
  "vendor_claim_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    notes: text("notes"),
    status: claimRequestStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdBy: uuid("created_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_claim_requests_vendor_id_idx").on(table.vendorId),
    // Documented since Phase 0's Business Rules & Invariants but only
    // buildable now that Phase 10 actually adds an approve action — the
    // partial-unique-index backstop (not just app logic) for "only one
    // Approved claim per vendor," same pattern as vendor_quotes' one-
    // accepted-per-event-vendor index.
    uniqueIndex("vendor_claim_requests_one_approved_per_vendor")
      .on(table.vendorId)
      .where(sql`status = 'approved'`),
    // Visible to the claimant themselves, or to the vendor's existing
    // active team (relevant once a vendor already has a team and a new
    // competing claim comes in) — never to other, unrelated claimants on
    // the same vendor. Approve/reject is Phase 10's admin console, via the
    // service role — no client-facing UPDATE policy needed here.
    pgPolicy("vendor_claim_requests_select_own_or_team", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.createdBy} = ${authUid} OR public.is_vendor_team_member(${table.vendorId}, ${authUid})`,
    }),
    pgPolicy("vendor_claim_requests_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.createdBy} = ${authUid}`,
    }),
  ],
).enableRLS();

// Phase 8 adds real policies (was service-role-only since Phase 0). Unlike
// event_collaborators, this table is keyed by an email address, not a
// user_id — see invite_email_matches_current_user's own migration comment
// (supabase/migrations/00000000000006_...) for why that needs a dedicated
// SECURITY DEFINER helper reading auth.users, not a plain column compare.
export const vendorTeamInvites = pgTable(
  "vendor_team_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    role: vendorRoleEnum("role").notNull().default("staff"),
    status: invitationStatusEnum("status").notNull().default("invited"),
    invitedBy: uuid("invited_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_team_invites_vendor_id_idx").on(table.vendorId),
    // Visible to the vendor's existing active team (so they can see who's
    // pending), or to the invitee themselves once they have an account
    // matching the invited email — even before accepting.
    pgPolicy("vendor_team_invites_select_team_or_invitee", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}) OR public.invite_email_matches_current_user(${table.invitedEmail}, ${authUid})`,
    }),
    // Only the Owner invites — Managers can quote and manage bookings, but
    // team composition is Owner-only per the Persona Model.
    pgPolicy("vendor_team_invites_insert_owner", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner'])`,
    }),
    // The Owner can revoke/cancel a pending invite; the invitee can accept
    // or decline their own.
    pgPolicy("vendor_team_invites_update_owner_or_invitee", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner']) OR public.invite_email_matches_current_user(${table.invitedEmail}, ${authUid})`,
    }),
  ],
).enableRLS();

export const vendorTeamMembers = pgTable(
  "vendor_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    role: vendorRoleEnum("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_team_members_vendor_id_idx").on(table.vendorId),
    index("vendor_team_members_user_id_idx").on(table.userId),
    // Live RLS join, not a snapshot — fixes the documented Salesforce
    // limitation where a teammate added after a booking already existed
    // couldn't see it. Any fellow active team member can see the roster.
    pgPolicy("vendor_team_members_select_own_team", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid} OR public.is_vendor_team_member(${table.vendorId}, ${authUid})`,
    }),
    // Gap found building the event-vendor chat feature, the mirror image
    // of events_select_vendor_side above: a planner viewing a booking's
    // chat needs to resolve "who is this vendor-side sender" to a display
    // name, which means reading this table — but a planner is neither the
    // team member's own row owner nor a fellow team member, so the policy
    // above alone left this silently empty for them (no error, just a
    // sender that could never be named — the RLS-filtered-select version
    // of the same class of gap, confirmed the same way, live). Scoped
    // tightly to vendors this event actually has a real booking with, not
    // blanket visibility into any vendor's roster.
    pgPolicy("vendor_team_members_select_event_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.vendor_id = ${table.vendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid})
        )
      )`,
    }),
    // Bootstrap case: a vendor's creator may insert exactly one row making
    // themselves Owner. Without this, a brand-new vendor could never get its
    // first team member at all — "only an existing Owner may add members"
    // has no valid Owner yet to satisfy itself. This is the same
    // chicken-and-egg bug the Salesforce build hit with Account creation for
    // self-registering vendors (see docs/gather_web_architecture.md) — caught
    // here at design time instead of by a failed live test.
    pgPolicy("vendor_team_members_insert_self_on_vendor_creation", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid} AND ${table.role} = 'owner' AND public.is_vendor_creator(${table.vendorId}, ${authUid})`,
    }),
    // Steady state: an existing active Owner may add further team members
    // directly (without going through the invite/accept flow at all).
    pgPolicy("vendor_team_members_insert_by_existing_owner", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner'])`,
    }),
    // Accepting an invite: the invitee inserts *themselves*, not an existing
    // Owner adding them — the previous policy can't cover this, since the
    // person accepting isn't a team member yet. Requires the matching
    // vendor_team_invites row to already be Accepted (the invitee updates
    // that row first, then inserts this one — two sequential writes, same
    // shape as Phase 7's accept-quote), and the role must match what was
    // actually offered, not whatever the client happens to send.
    pgPolicy("vendor_team_members_insert_self_on_accepted_invite", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid} AND EXISTS (
        SELECT 1 FROM vendor_team_invites vti
        WHERE vti.vendor_id = ${table.vendorId}
          AND vti.role = ${table.role}
          AND vti.status = 'accepted'
          AND public.invite_email_matches_current_user(vti.invited_email, ${authUid})
      )`,
    }),
    pgPolicy("vendor_team_members_update_by_owner", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner'])`,
    }),
    pgPolicy("vendor_team_members_delete_by_owner", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner'])`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Event <-> Vendor commercial relationship
// ---------------------------------------------------------------------------

export const eventVendors = pgTable(
  "event_vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id),
    vendorId: uuid("vendor_id").notNull().references(() => vendors.id),
    status: eventVendorStatusEnum("status").notNull().default("interested"),
    vendorType: text("vendor_type"),
    notes: text("notes"),
    confirmed: boolean("confirmed").notNull().default(false),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_vendors_event_id_idx").on(table.eventId),
    index("event_vendors_vendor_id_idx").on(table.vendorId),
    // Visible to the event's owner/accepted collaborators, or to the
    // vendor's own active team — a direct port of EventVendorSharingManager,
    // computed live instead of snapshotted at association time.
    pgPolicy("event_vendors_select_event_side_or_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid})
        OR public.is_event_collaborator(${table.eventId}, ${authUid})
        OR public.is_vendor_team_member(${table.vendorId}, ${authUid})`,
    }),
    // Only the event owner or an accepted Editor collaborator creates the
    // association (the planner-side "Add Vendor" action).
    pgPolicy("event_vendors_insert_event_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    // Either side can update status/notes/confirmed — the planner side
    // (owner/editor) or the vendor's own Manager+ team.
    pgPolicy("event_vendors_update_event_editor_or_vendor_manager", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid})
        OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')
        OR public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner', 'manager'])`,
    }),
  ],
).enableRLS();

// A planner's own line-item breakdown of an event's budget — same
// owner-or-accepted-collaborator (select) / owner-or-editor (write) shape
// as event_tasks/event_attendees, and the same planner-only spirit as
// payment_plans below (no vendor-side policy branch at all). categoryId
// reuses the same service_categories taxonomy vendor_services already
// tags with, both so a line's "kind" is consistent across the app and so
// the "link a vendor" step can suggest vendors whose services match.
// eventVendorId is the one linked booking (nullable until decided) — see
// this session's plan doc for why "one vendor per line" was chosen over a
// multi-candidate comparison model.
export const budgetItems = pgTable(
  "budget_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    budgetedAmount: numeric("budgeted_amount", { precision: 12, scale: 2 }).notNull(),
    eventVendorId: uuid("event_vendor_id").references(() => eventVendors.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("budget_items_event_id_idx").on(table.eventId),
    pgPolicy("budget_items_select_owner_or_collaborator", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid})`,
    }),
    pgPolicy("budget_items_insert_owner_or_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("budget_items_update_owner_or_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
    pgPolicy("budget_items_delete_owner_or_editor", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_event_owner(${table.eventId}, ${authUid}) OR public.is_event_collaborator(${table.eventId}, ${authUid}, 'editor')`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Commerce — Phase 7 adds real policies (was service-role-only since
// Phase 0). Every policy below re-derives event/vendor-side access by
// walking up to `event_vendors` inline (owner/collaborator on the event
// side, Owner/Manager team member on the vendor side) — the same shape
// `event_vendors` itself already uses, just one or two hops further out.
// These inline EXISTS subqueries are themselves subject to the referenced
// table's own RLS (a real table reference, not a SECURITY DEFINER
// bypass) — harmless double-checking, not a recursion risk, since
// event_vendors'/payment_plans' own policies only ever call the existing
// SECURITY DEFINER helpers (is_event_owner etc.), never reference back
// down to these commerce tables.
// ---------------------------------------------------------------------------

export const vendorQuotes = pgTable(
  "vendor_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventVendorId: uuid("event_vendor_id").notNull().references(() => eventVendors.id, { onDelete: "cascade" }),
    quoteNumber: text("quote_number"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: text("description"),
    validUntil: date("valid_until"),
    status: vendorQuoteStatusEnum("status").notNull().default("draft"),
    createdByVendor: boolean("created_by_vendor").notNull().default(true),
    documentUrl: text("document_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_quotes_event_vendor_id_idx").on(table.eventVendorId),
    // Only one Accepted quote per event-vendor relationship at a time — a
    // partial unique index, synchronous and unconditional (no async
    // recalculation lag to reason about, unlike the Salesforce trigger this
    // replaces). See docs/gather_web_architecture.md's Business Rules table.
    uniqueIndex("vendor_quotes_one_accepted_per_event_vendor")
      .on(table.eventVendorId)
      .where(sql`${table.status} = 'accepted'`),
    pgPolicy("vendor_quotes_select_event_side_or_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid})
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid})
        )
      )`,
    }),
    // Only the vendor's own Manager+ team submits a quote — never the event
    // side. "createdByVendor" distinguishes this from a planner's own quick
    // single-figure note on event_vendors.amount, which needs no quote row.
    pgPolicy("vendor_quotes_insert_vendor_manager", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId}
          AND public.is_vendor_team_member(ev.vendor_id, ${authUid}, ARRAY['owner', 'manager'])
      )`,
    }),
    // Event owner/editor accepts or declines; the vendor's own Manager+ can
    // still edit their own quote (e.g. before it's reviewed) — RLS only
    // gates whether the row can be touched at all, not which columns; the
    // Server Actions for each side only ever send the fields appropriate
    // to that action.
    pgPolicy("vendor_quotes_update_event_editor_or_vendor_manager", {
      for: "update",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid}, ARRAY['owner', 'manager'])
        )
      )`,
    }),
  ],
).enableRLS();

export const paymentPlans = pgTable(
  "payment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventVendorId: uuid("event_vendor_id").notNull().references(() => eventVendors.id, { onDelete: "cascade" }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
    depositDueDate: date("deposit_due_date"),
    status: paymentPlanStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    // Optional tag to a budget line item — additive, doesn't replace
    // eventVendorId as the plan's real anchor. A plan can exist (and count
    // toward an event's committed spend) with this left null, same as
    // today; tagging it here is purely for the Budget page's per-line
    // display.
    budgetItemId: uuid("budget_item_id").references(() => budgetItems.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_plans_event_vendor_id_idx").on(table.eventVendorId),
    index("payment_plans_budget_item_id_idx").on(table.budgetItemId),
    pgPolicy("payment_plans_select_event_side_or_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid})
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid})
        )
      )`,
    }),
    // Setting up a payment plan is a planner action only — no vendor-side
    // branch, unlike vendor_quotes' policies.
    pgPolicy("payment_plans_insert_event_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
        )
      )`,
    }),
    pgPolicy("payment_plans_update_event_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
        )
      )`,
    }),
    // Added for removeVendorFromEvent (events/[id]/vendors/[eventVendorId]/
    // actions.ts): removing a vendor is a soft-remove on event_vendors
    // itself (status -> 'rejected', see that file's own comment on why), but
    // its payment plan is a real delete — hasPaidInstallment already blocks
    // the whole removal while any installment is still actually paid, so by
    // the time this policy is reached the plan can only hold pending/
    // cancelled/refunded installments, nothing left worth preserving as an
    // orphaned "removed vendor's plan" that would otherwise keep showing up
    // everywhere the vendor picker/Budget page look for this event_vendor's
    // plans. Same event-editor scope as insert/update above.
    pgPolicy("payment_plans_delete_event_editor", {
      for: "delete",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
        )
      )`,
    }),
  ],
).enableRLS();

// A chat ring-fenced to exactly one event_vendors row — a planner working
// several vendors and a vendor working several events each only ever see
// one thread per booking, never a cross-event/cross-vendor inbox. Same
// EXISTS-against-event_vendors idiom as vendor_quotes/payment_plans above.
// Unlike payment_plans (planner-only writes) this is bidirectional like
// vendor_quotes, but unlike vendor_quotes' vendor-Manager+-only INSERT,
// any active vendor team member can send — chat is day-to-day
// communication, not a management action. `body`/`storagePath` are both
// nullable (an image-only message has no text and vice versa); the "at
// least one must be present" rule is validated in the Server Action, the
// same layer this app already validates shape-of-input rules at (e.g.
// budgetedAmount > 0), not a DB CHECK constraint. No UPDATE/DELETE policy
// — messages are immutable in v1, the same posture event_vendors itself
// already takes (no delete policy at all).
export const eventVendorMessages = pgTable(
  "event_vendor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventVendorId: uuid("event_vendor_id")
      .notNull()
      .references(() => eventVendors.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body"),
    storagePath: text("storage_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("event_vendor_messages_event_vendor_id_idx").on(table.eventVendorId),
    pgPolicy("event_vendor_messages_select_event_side_or_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid})
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid})
        )
      )`,
    }),
    // sender_id = authUid is the same self-row idiom
    // notification_preferences_insert_own uses (this file, "profileId =
    // authUid") — without it, anyone with write access on their own side
    // could insert a message impersonating a different sender on that
    // same side.
    //
    // The vendor-side branch also requires is_vendor_verified — a real gap
    // found after shipping: vendor_team_members membership itself needs no
    // verification at all (a vendor's own creator becomes its Owner team
    // member immediately on creation, unclaimed/claim_pending included —
    // vendor_team_members_insert_self_on_vendor_creation), so without this,
    // literally anyone who creates a vendor stub could message any planner
    // who links it to their event, with zero admin review in between.
    // Matches the exact same is_vendor_verified gate
    // vendor_gallery_images/vendor_social_links' own INSERT policies
    // already use for vendor-side writes — this just extends it to chat.
    // Deliberately asymmetric: the planner side has NO added verification
    // check — a planner choosing to message a vendor they already linked
    // to their own event is a planner-initiated, low-risk action (and the
    // planner may have real pre-booking questions before a vendor is even
    // claimed); it's an unverified vendor initiating contact that's the
    // actual risk this closes.
    pgPolicy("event_vendor_messages_insert_event_editor_or_vendor_member", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.senderId} = ${authUid} AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
          OR (public.is_vendor_team_member(ev.vendor_id, ${authUid}) AND public.is_vendor_verified(ev.vendor_id))
        )
      )`,
    }),
  ],
).enableRLS();

// Per-user, per-thread "I've seen everything up to here" marker — what
// powers the unread-count badges on the event's vendor list and the
// vendor's own bookings list. One row per (thread, person), upserted by
// markChatThreadRead whenever that person actually looks at the thread.
// Composite PK, same shape as event_type_service_categories: the row
// carries no payload beyond the pair (plus the one timestamp), and every
// write already has both ids in hand.
export const eventVendorChatReads = pgTable(
  "event_vendor_chat_reads",
  {
    eventVendorId: uuid("event_vendor_id")
      .notNull()
      .references(() => eventVendors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventVendorId, table.userId] }),
    // Nobody but the reader themselves ever needs to see their own
    // read-state — unlike event_vendor_messages, there's no "the other
    // side can see it too" branch here at all.
    pgPolicy("event_vendor_chat_reads_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    // Same EXISTS-against-event_vendors idiom as event_vendor_messages'
    // own insert policy — you can only mark a thread read if you could
    // actually see it in the first place.
    pgPolicy("event_vendor_chat_reads_upsert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid} AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid})
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid})
        )
      )`,
    }),
    pgPolicy("event_vendor_chat_reads_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const paymentInstallments = pgTable(
  "payment_installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentPlanId: uuid("payment_plan_id").notNull().references(() => paymentPlans.id, { onDelete: "cascade" }),
    installmentNumber: integer("installment_number").notNull(),
    dueDate: date("due_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: installmentStatusEnum("status").notNull().default("pending"),
    paidOn: date("paid_on"),
    paymentGateway: text("payment_gateway"),
    gatewayTransactionId: text("gateway_transaction_id"),
    gatewayStatus: text("gateway_status"),
    // Andre's own ask: a proof-of-payment document (a bank EFT screenshot,
    // an emailed receipt) attached directly to the installment it actually
    // proves, "so it's not lost in a mailbox." Nullable — no backfill for
    // existing rows, same tolerance this project already extends to other
    // additive columns (vendor_gallery_images.caption,
    // vendor_services.category_id). No new RLS policy needed on this table
    // for it — the existing owner-or-editor UPDATE policy already covers
    // writing it, same as paid_on/status already are.
    proofOfPaymentPath: text("proof_of_payment_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_installments_payment_plan_id_idx").on(table.paymentPlanId),
    pgPolicy("payment_installments_select_event_side_or_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = ${table.paymentPlanId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid})
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid})
        )
      )`,
    }),
    pgPolicy("payment_installments_insert_event_editor", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = ${table.paymentPlanId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
        )
      )`,
    }),
    // Marking paid is a planner action — "she marks the deposit paid the
    // moment it clears" — not something the vendor side does in this phase.
    pgPolicy("payment_installments_update_event_editor", {
      for: "update",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = ${table.paymentPlanId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
        )
      )`,
    }),
  ],
).enableRLS();

// Was SELECT-only, with no scheduling infra ever chosen (Supabase Edge
// Functions + pg_cron vs. Inngest — still genuinely undecided). Rather than
// wait on that decision, reminders are sent *implicitly*: whenever a
// signed-in planner's own request would already show them an overdue/
// due-soon installment (Home, My Events, the event page), a client-side
// check fires once per app session and, for anything not already reminded,
// sends the email and records it here itself — no cron, no scheduler,
// nothing running when nobody's using the app. That's the one new access
// pattern below: a planner can insert their own reminder-sent record for an
// installment on an event they own or edit. Still no UPDATE/DELETE policy
// (a sent reminder is never un-sent) and no vendor-side branch (matching
// payment_installments' own planner-only write posture).
export const paymentReminders = pgTable(
  "payment_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentInstallmentId: uuid("payment_installment_id")
      .notNull()
      .references(() => paymentInstallments.id, { onDelete: "cascade" }),
    contactUserId: uuid("contact_user_id").references(() => profiles.id),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    method: reminderMethodEnum("method").notNull().default("email"),
    sent: boolean("sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_reminders_payment_installment_id_idx").on(table.paymentInstallmentId),
    pgPolicy("payment_reminders_select_event_side_or_vendor_side", {
      for: "select",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM payment_installments pi
        JOIN payment_plans pp ON pp.id = pi.payment_plan_id
        JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pi.id = ${table.paymentInstallmentId} AND (
          public.is_event_owner(ev.event_id, ${authUid})
          OR public.is_event_collaborator(ev.event_id, ${authUid})
          OR public.is_vendor_team_member(ev.vendor_id, ${authUid})
        )
      )`,
    }),
    // The implicitly-triggered reminder check (checkAndSendPaymentReminders,
    // called from ReminderChecker on the client) inserts as the signed-in
    // planner themselves — contact_user_id pinned to auth.uid(), same
    // self-only shape support_cases_insert_self uses, plus the same
    // owner-or-editor-collaborator check payment_installments' own INSERT
    // policy uses so a reminder can't be recorded against an event this
    // user has no real write access to.
    pgPolicy("payment_reminders_insert_self", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.contactUserId} = ${authUid} AND EXISTS (
        SELECT 1 FROM payment_installments pi
        JOIN payment_plans pp ON pp.id = pi.payment_plan_id
        JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pi.id = ${table.paymentInstallmentId} AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid}, 'editor')
        )
      )`,
    }),
  ],
).enableRLS();

// The task-reminder twin of payment_reminders directly above — same
// implicit-trigger shape (checkAndSendTaskReminders, called alongside the
// payment check from the same <ReminderChecker>), same "record it so it's
// never repeated" idempotency table, no scheduler either. One real
// difference: event_tasks.assignedTo exists in the schema but nothing in
// the app UI has ever set or read it (no assignment feature is actually
// built yet) — so this deliberately doesn't try to be assignment-aware.
// Instead it mirrors event_tasks' own SELECT policy exactly: a task is
// visible to (and here, reminds) the owner or *any* collaborator, not just
// an editor — a Viewer should still hear about a task coming due on an
// event they're following, the same way Home's own Upcoming Tasks section
// already shows it to them with no role filtering.
export const taskReminders = pgTable(
  "task_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventTaskId: uuid("event_task_id")
      .notNull()
      .references(() => eventTasks.id, { onDelete: "cascade" }),
    contactUserId: uuid("contact_user_id").references(() => profiles.id),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    method: reminderMethodEnum("method").notNull().default("email"),
    sent: boolean("sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_reminders_event_task_id_idx").on(table.eventTaskId),
    // Self-only — unlike payment_reminders' both-sides SELECT (a vendor
    // legitimately cares whether *their own* payment was reminded about), a
    // task reminder has no second party who'd ever need to read someone
    // else's reminder record; only the reminder check itself, reading back
    // its own prior writes, ever queries this.
    pgPolicy("task_reminders_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.contactUserId} = ${authUid}`,
    }),
    pgPolicy("task_reminders_insert_self", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.contactUserId} = ${authUid} AND EXISTS (
        SELECT 1 FROM event_tasks et
        WHERE et.id = ${table.eventTaskId} AND (
          public.is_event_owner(et.event_id, ${authUid}) OR public.is_event_collaborator(et.event_id, ${authUid})
        )
      )`,
    }),
  ],
).enableRLS();

// A planner's review of a completed booking — eligibility gated to
// `status = 'contracted'` bookings only (chosen over "anyone who added the
// vendor" so a review reflects an actual booking, not a browse), and to
// *any* accepted collaborator on that event, not just an editor — reviewing
// is closer to an opinion than a shared-plan edit, the same reasoning
// task_reminders' own SELECT-scope comment already makes. One review per
// (booking, reviewer) — a unique index, not just per-booking — so an owner
// and a collaborator who both experienced the same booking can each leave
// their own.
//
// `vendorId` IS denormalized here, deliberately reversing this table's own
// original comment (which argued for joining through `event_vendors`
// instead, the same shape `vendor_quotes`/`payment_plans` use) — that
// reasoning turned out to miss something those tables don't share: a
// PostgREST embed like `vendor_reviews!select(...event_vendors(...))` is a
// real join, subject to the embedded table's OWN RLS, and `event_vendors`
// is deliberately NOT public (only the event's own people or the vendor's
// team can see a booking row) — while `vendor_reviews` itself IS meant to
// be public. The result, caught by a real Playwright pass browsing as a
// third party with no relationship to the reviewed booking: reviews
// silently vanished for exactly the person the feature exists for, a
// planner just browsing a vendor's profile. `vendorId` lets every read here
// stay entirely within `vendor_reviews`' own public policy, no join to a
// non-public table required. Both write policies re-verify it against the
// booking's real `event_vendors.vendor_id` — same "the DB enforces it, not
// just the app" posture as everything else in this file — so it can never
// drift from the booking it's attached to despite being stored. No stored
// rating average anywhere, though — that part of the original reasoning
// still holds; `getVendorRatingSummary()` (src/lib/vendor-reviews.ts)
// computes it fresh, the same "derive it, don't store a flag nothing
// maintains" fix as vendor-completion's percent and installment
// overdue-ness before it.
export const vendorReviews = pgTable(
  "vendor_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventVendorId: uuid("event_vendor_id")
      .notNull()
      .references(() => eventVendors.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => profiles.id),
    rating: smallint("rating").notNull(),
    reviewText: text("review_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_reviews_event_vendor_id_idx").on(table.eventVendorId),
    index("vendor_reviews_vendor_id_idx").on(table.vendorId),
    uniqueIndex("vendor_reviews_one_per_booking_reviewer").on(table.eventVendorId, table.reviewerId),
    check("vendor_reviews_rating_range", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
    // Public, like the vendor profile itself — a guest deciding whether to
    // even start planning reads reviews the same way they'd read the
    // Featured/Verified badges, no sign-in required.
    pgPolicy("vendor_reviews_select_public", {
      for: "select",
      to: [authenticatedRole, anonRole],
      using: sql`true`,
    }),
    pgPolicy("vendor_reviews_insert_self", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.reviewerId} = ${authUid} AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND ev.vendor_id = ${table.vendorId} AND ev.status = 'contracted' AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid})
        )
      )`,
    }),
    // Edit-in-place, own review only. `using` alone (own row) previously let
    // a forged PATCH retarget an existing review at a different booking or
    // vendor with no eligibility check at all — a real gap, closed here
    // with a matching `withCheck` that re-verifies the same
    // contracted-booking condition INSERT already requires against the
    // row's *new* values, the same way Postgres UPDATE policies are meant
    // to combine the two clauses. No re-check of the booking's status
    // beyond that (a booking that later moves off "contracted" shouldn't
    // retract a review that was legitimately earned while it was) — only
    // `vendor_id`/`event_vendor_id` integrity is being guarded here.
    pgPolicy("vendor_reviews_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.reviewerId} = ${authUid}`,
      withCheck: sql`${table.reviewerId} = ${authUid} AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = ${table.eventVendorId} AND ev.vendor_id = ${table.vendorId} AND ev.status = 'contracted' AND (
          public.is_event_owner(ev.event_id, ${authUid}) OR public.is_event_collaborator(ev.event_id, ${authUid})
        )
      )`,
    }),
  ],
).enableRLS();

// The vendor's public reply — its own table, not two more columns on
// vendor_reviews, deliberately: a shared-row UPDATE policy can't restrict
// *which* columns each side may touch (RLS is row-scoped, not
// column-scoped — the same limit `vendors.is_featured` needed a real
// column-GRANT migration to work around), and unlike vendor_quotes' own
// both-sides-can-update row (a negotiation both parties are meant to
// shape), a review and its reply have adversarial incentives — a vendor
// should never be one forged PATCH away from quietly editing a bad rating.
// A separate table sidesteps that without needing a column-grant migration
// at all: the reviewer can only ever write vendor_reviews, the vendor's
// Owner/Manager team can only ever write vendor_review_replies.
export const vendorReviewReplies = pgTable(
  "vendor_review_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorReviewId: uuid("vendor_review_id")
      .notNull()
      .references(() => vendorReviews.id, { onDelete: "cascade" })
      .unique(),
    replyText: text("reply_text").notNull(),
    repliedBy: uuid("replied_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy("vendor_review_replies_select_public", {
      for: "select",
      to: [authenticatedRole, anonRole],
      using: sql`true`,
    }),
    pgPolicy("vendor_review_replies_insert_vendor_manager", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.repliedBy} = ${authUid} AND EXISTS (
        SELECT 1 FROM vendor_reviews vr JOIN event_vendors ev ON ev.id = vr.event_vendor_id
        WHERE vr.id = ${table.vendorReviewId} AND public.is_vendor_team_member(ev.vendor_id, ${authUid}, ARRAY['owner', 'manager'])
      )`,
    }),
    // Any Owner/Manager teammate may edit the reply, not just whoever
    // originally wrote it — the same "the vendor account manages it as a
    // team" posture already used for services/social links/gallery.
    pgPolicy("vendor_review_replies_update_vendor_manager", {
      for: "update",
      to: authenticatedRole,
      using: sql`EXISTS (
        SELECT 1 FROM vendor_reviews vr JOIN event_vendors ev ON ev.id = vr.event_vendor_id
        WHERE vr.id = ${table.vendorReviewId} AND public.is_vendor_team_member(ev.vendor_id, ${authUid}, ARRAY['owner', 'manager'])
      )`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Phase 10 — Admin & Support Console
// ---------------------------------------------------------------------------
// See docs/gather_web_admin_architecture.md for the full design. Originally
// all three tables below were .enableRLS() with ZERO regular policies,
// deliberately — cases were admin-logged only (a phone call, an email), and
// case notes can carry sensitive internal discussion, so there was no
// legitimate Planner/Vendor access pattern to design a policy for. That
// changed the day self-service "Report an Issue" (Profile tab) shipped —
// see the two new policies on supportCases below, added for exactly that. A
// real access pattern now exists for that one table; support_case_comments
// and admin_audit_log stay exactly as locked-down as before (a case's own
// comment thread can still carry internal admin-to-admin discussion, so a
// reporter seeing their own case's *status* is as far as this goes — no
// comment visibility yet). The only way into the other two is still the
// service-role client, used exclusively by code that has already passed
// requireAdmin() (src/lib/admin/require-admin.ts) — the same "service role
// instead of policy sprawl" reasoning as the guest-RSVP path, just with a
// much wider blast radius, which is why the admin doc calls out keeping the
// service-role client entirely inside src/app/admin/** as a hard rule.

export const supportCases = pgTable(
  "support_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: text("subject").notNull(),
    description: text("description"),
    status: supportCaseStatusEnum("status").notNull().default("open"),
    priority: supportCasePriorityEnum("priority").notNull().default("normal"),
    // Nullable: only ever set by the self-service form — the pre-existing
    // admin-logged path (a phone call, an email) has no natural category to
    // backfill and doesn't ask for one.
    category: supportCaseCategoryEnum("category"),
    // The optional screenshot from "Report an Issue" — same single-current-
    // file shape as payment_installments.proof_of_payment_path, just scoped
    // to the reporting user's own storage folder rather than a record id,
    // since the case row doesn't exist yet at the moment of upload (see the
    // support-case-attachments bucket migration for why).
    attachmentPath: text("attachment_path"),
    requesterId: uuid("requester_id").references(() => profiles.id),
    relatedEventId: uuid("related_event_id").references(() => events.id),
    relatedVendorId: uuid("related_vendor_id").references(() => vendors.id),
    assignedAdminId: uuid("assigned_admin_id").references(() => profiles.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("support_cases_status_idx").on(table.status),
    index("support_cases_requester_id_idx").on(table.requesterId),
    index("support_cases_related_event_id_idx").on(table.relatedEventId),
    index("support_cases_related_vendor_id_idx").on(table.relatedVendorId),
    index("support_cases_assigned_admin_id_idx").on(table.assignedAdminId),
    // Self-service create: a signed-in user can log a case about their own
    // account, as themselves only — created_by and requester_id both pinned
    // to auth.uid() so nobody can file a case *as* someone else or leave the
    // requester unset (the admin-logged path leaves requester_id null for a
    // general platform issue with no known reporter; that path still goes
    // through the service-role client, which bypasses RLS entirely, so this
    // NOT NULL-ish check here only ever constrains the self-service form).
    pgPolicy("support_cases_insert_self", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.createdBy} = ${authUid} AND ${table.requesterId} = ${authUid}`,
    }),
    // Self-service read: a reporter can see their own case's status/details
    // (so "Report an Issue" has somewhere to show "we got it, here's where
    // it stands") — not the comment thread, which stays admin-only.
    pgPolicy("support_cases_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.requesterId} = ${authUid}`,
    }),
  ],
).enableRLS();

export const supportCaseComments = pgTable(
  "support_case_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => supportCases.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("support_case_comments_case_id_idx").on(table.caseId)],
).enableRLS();

// Accountability trail for admin *mutations* only (not reads) — editing a
// planner's profile, cancelling an event, approving/rejecting a claim,
// resolving a case. `target_table`/`target_id` are plain text/uuid, not a
// real FK, since the target can be any table in the schema. Write-only from
// the app's perspective: nothing in the admin UI reads its own writes back
// mid-request, only ever displayed as a recent-activity feed on a later
// request.
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => profiles.id),
    action: text("action").notNull(),
    targetTable: text("target_table").notNull(),
    targetId: uuid("target_id"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("admin_audit_log_admin_id_idx").on(table.adminId),
    index("admin_audit_log_target_idx").on(table.targetTable, table.targetId),
    index("admin_audit_log_created_at_idx").on(table.createdAt),
  ],
).enableRLS();

// Paid featured placement for a vendor — replaces the old vendors.is_featured
// boolean, which had no dates, no lifecycle, and no ordering. One row per
// purchase: status is the admin-managed part (pending until the vendor has
// paid, activated once confirmed, cancelled if withdrawn); "live",
// "scheduled" and "ended" are DERIVED from status + the date window at read
// time, not stored, since this stack has no scheduler to flip a stored
// "expired" flag and a flag nothing maintains would silently go stale (see
// public.is_featured() in the vendor_feature_placements migration).
// Dates are plain dates in South African time, inclusive on both ends.
// position: 1, 2, 3… pins the vendor at that rank among featured vendors;
// null puts it in the rotating pool, ordered fairly per day (see
// src/lib/vendor-ranking.ts). Admin-only: RLS on with no policies, written
// through the service role behind requireAdmin() like the rest of the admin
// console; public pages learn "featured / rank" only through the
// SECURITY DEFINER computed columns on vendors, never by reading this table
// (so fee_amount and note stay private).
export const vendorFeaturePlacements = pgTable(
  "vendor_feature_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    status: featurePlacementStatusEnum("status").notNull().default("pending"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    position: integer("position"),
    feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }),
    note: text("note"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_feature_placements_vendor_id_idx").on(table.vendorId),
    index("vendor_feature_placements_window_idx").on(table.status, table.startsOn, table.endsOn),
    check("vendor_feature_placements_dates_check", sql`${table.endsOn} >= ${table.startsOn}`),
    check("vendor_feature_placements_position_check", sql`${table.position} IS NULL OR ${table.position} >= 1`),
  ],
).enableRLS();
