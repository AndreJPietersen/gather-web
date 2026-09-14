import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  pgPolicy,
  index,
  uniqueIndex,
  primaryKey,
  uuid,
  text,
  boolean,
  integer,
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
export const installmentStatusEnum = pgEnum("installment_status", ["pending", "paid", "late", "cancelled"]);
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

// SELECT-only for now — reminders are an automated background-job feature
// (the Salesforce build's hourly PaymentReminderScheduler) with no
// scheduling infra chosen yet (see the stack table: Supabase Edge
// Functions + pg_cron, or Inngest — still undecided). No UI creates these
// yet, so INSERT/UPDATE/DELETE stay service-role-only until that phase.
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
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Phase 10 — Admin & Support Console
// ---------------------------------------------------------------------------
// See docs/gather_web_admin_architecture.md for the full design. All three
// tables below are .enableRLS() with ZERO regular policies, deliberately —
// there's no legitimate Planner/Vendor access pattern to design a policy
// for (this is internal support tooling, and case notes can contain
// sensitive discussion), so every table here starts, and stays, completely
// locked down to authenticated/anon roles. The only way in is the
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
