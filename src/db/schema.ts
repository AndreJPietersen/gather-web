import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  pgPolicy,
  index,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  date,
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

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => profiles.id),
    name: text("name").notNull(),
    eventType: text("event_type"),
    status: eventStatusEnum("status").notNull().default("draft"),
    visibility: eventVisibilityEnum("visibility").notNull().default("private"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    location: text("location"),
    description: text("description"),
    capacity: integer("capacity"),
    coverImageUrl: text("cover_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // RLS policies below constantly filter/join on owner_id — index it.
    index("events_owner_id_idx").on(table.ownerId),
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

export const eventAttendees = pgTable("event_attendees", {
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
}).enableRLS();

export const eventTasks = pgTable("event_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  completed: boolean("completed").notNull().default(false),
  priority: text("priority"),
  assignedTo: uuid("assigned_to").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

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
    // Verified vendors are publicly browsable (the vendor directory) with no
    // auth required; an unclaimed stub is visible to its creator; any vendor
    // is visible to its own active team.
    pgPolicy("vendors_select_public_or_own", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${table.verificationStatus} = 'verified' OR ${table.createdBy} = ${authUid} OR public.is_vendor_team_member(${table.id}, ${authUid})`,
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

export const vendorServices = pgTable("vendor_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
}).enableRLS();

export const vendorClaimRequests = pgTable("vendor_claim_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  notes: text("notes"),
  status: claimRequestStatusEnum("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const vendorTeamInvites = pgTable("vendor_team_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  role: vendorRoleEnum("role").notNull().default("staff"),
  status: invitationStatusEnum("status").notNull().default("invited"),
  invitedBy: uuid("invited_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

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
    // (e.g. accepting a vendor_team_invites row).
    pgPolicy("vendor_team_members_insert_by_existing_owner", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_vendor_team_member(${table.vendorId}, ${authUid}, ARRAY['owner'])`,
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

// ---------------------------------------------------------------------------
// Commerce — schema only for now, RLS policies land with the Commerce phase.
// ---------------------------------------------------------------------------

export const vendorQuotes = pgTable("vendor_quotes", {
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
}).enableRLS();

export const paymentPlans = pgTable("payment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventVendorId: uuid("event_vendor_id").notNull().references(() => eventVendors.id, { onDelete: "cascade" }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
  depositDueDate: date("deposit_due_date"),
  status: paymentPlanStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const paymentInstallments = pgTable("payment_installments", {
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
}).enableRLS();

export const paymentReminders = pgTable("payment_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentInstallmentId: uuid("payment_installment_id")
    .notNull()
    .references(() => paymentInstallments.id, { onDelete: "cascade" }),
  contactUserId: uuid("contact_user_id").references(() => profiles.id),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  method: reminderMethodEnum("method").notNull().default("email"),
  sent: boolean("sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();
