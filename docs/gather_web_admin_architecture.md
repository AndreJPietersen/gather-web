# Gather Web — Admin & Support Console Architecture

**Status:** Built and verified 2026-09-14, exactly as designed below — see `gather_web_architecture.md`'s engineering log for the "how this was actually verified" account and the one real implementation deviation worth knowing about (how `/admin`'s desktop-only shell was actually achieved). Companion to `gather_web_architecture.md` (the consumer-facing product this console has read/write access into), `gather_web_epic_roadmap.md` (where this slots in as Phase 10), and `gather_web_user_journeys.md` (Planner/Vendor journeys this console exists to support).

## Context

Every phase so far (0–9) builds the consumer-facing product — Planner and Vendor personas, both self-service. Nothing plays the role Salesforce's own Setup/Object Manager played for free on the old build: a System Administrator profile could always open any record, any list view, any related list, with no custom "admin app" ever needing to be built. That capability doesn't exist here — Postgres + Next.js has no equivalent free admin surface, and RLS is deliberately deny-by-default. A support console has to be built as real, first-class product surface, not assumed.

Scope, per the decisions made discussing this: a **full CRM-style console** — view any planner, vendor, or event; edit records directly when a support situation calls for it; and a lightweight case/ticket system (the rough equivalent of Salesforce Cases) for logging and tracking support interactions — not just a read-only dashboard. Admin access itself stays deliberately simple: a **small, manually-flagged set of internal staff**, no self-service admin signup or promotion flow.

---

## Admin Identity & Authorization Model

### Who's an admin

A single boolean, not a new identity system: `profiles.is_admin boolean not null default false`. Being an admin is orthogonal to being a Planner or Vendor — the same person can be all three at once (an internal team member testing the product, say). There's no "Admin" entry in the persona switcher; admin-ness isn't a persona you switch into, it's a capability layered on top of whichever persona you're already using.

Flipped by hand, directly in Supabase Studio or a one-off SQL statement — deliberately not exposed anywhere in the product UI. This mirrors how a Salesforce System Administrator profile is just a profile assignment on the User record, done by another admin in Setup, not a self-service action.

### How access is actually enforced — service role, not per-table RLS policies

The other tables in this project each got a narrow RLS policy per legitimate access pattern (owner, accepted collaborator, vendor team member, and so on). Admin access is different in kind: it needs to see and touch *everything*, across every table, indefinitely as new tables get added — the RLS equivalent of Salesforce's "View All Data" / "Modify All Data" system permissions, which are also a blanket bypass, not a sharing rule. Adding an `OR is_admin(auth.uid())` clause to every policy on every table, forever, is exactly the kind of policy-sprawl this project's own RLS lessons (`teachAndre/02-postgres-rls-in-practice.md`) warn is easy to get subtly wrong at scale.

Instead: every `/admin/*` Server Component and Server Action starts by calling a `requireAdmin()` guard, and only after that passes does it use the **service-role client** (`src/lib/supabase/service.ts`, already established in Phase 3) for all of its actual data access — bypassing RLS entirely, deliberately, the same way the guest-RSVP path already does for a much narrower case. This avoids policy sprawl and matches the Salesforce mental model more directly: an admin isn't "shared" a record through some grant, they simply aren't subject to the sharing model at all.

```ts
// src/lib/admin/require-admin.ts
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // An RPC call to a SECURITY DEFINER function, not a direct
  // `.from("profiles").select("is_admin")` — see "Why not just read the
  // column" below.
  const { data: isAdmin } = await supabase.rpc("is_admin", { p_user_id: user.id });
  if (!isAdmin) notFound();

  return { userId: user.id };
}
```

Every admin page and every admin Server Action calls this **first**, unconditionally — per this project's own established security principle (see `docs/gather_web_architecture.md` citing the Next.js Data Security guide): render-time gating (a layout that just doesn't render a nav link) is not a security boundary, because a request can always be sent directly. `notFound()` rather than a redirect for a non-admin: an admin route shouldn't even confirm its own existence to someone probing it.

**Why not just read the column** (`select("is_admin").eq("id", user.id)`): `profiles`' existing `profiles_select_all_authenticated` policy grants full-row SELECT to *any* signed-in or anonymous request (`using: true`) — already a known, flagged-but-not-yet-fixed looseness from Phase 4/5 (it's why `email` was deliberately kept off that table entirely). Adding `is_admin` as a plain column would make "who are the admins" queryable by anyone. Routing the check through a `SECURITY DEFINER` function instead — `is_admin(p_user_id uuid) returns boolean`, same pattern as `is_event_owner`/`is_vendor_team_member` — returns only a boolean to the caller and never exposes the underlying column via the normal RLS-gated path, sidestepping that exposure regardless of how loose `profiles_select_all_authenticated` stays. (This is also the template for eventually tightening `phone`'s exposure the same way, whenever that gets picked up — not part of this phase's scope.)

---

## Data Model Additions

| Table | Purpose | RLS |
|---|---|---|
| `profiles.is_admin` | New column, default `false`. | Covered by existing `profiles` policies; never read directly by app code — always through `is_admin()`. |
| `support_cases` | A support interaction: `id`, `subject`, `description`, `status` (`open`/`pending`/`resolved`/`closed`), `priority` (`low`/`normal`/`high`/`urgent`), `category` (nullable — `payments_billing`/`vendor_booking`/`event_setup`/`account_verification`/`app_bug`/`other`; only ever set by the self-service form, see Open Question #2 below), `attachment_path` (nullable — an optional screenshot), `requester_id` (nullable → `profiles.id` — the planner/vendor the case is about, if any), `related_event_id` (nullable → `events.id`), `related_vendor_id` (nullable → `vendors.id`), `assigned_admin_id` (nullable → `profiles.id`), `created_by` (→ `profiles.id`), `created_at`, `updated_at`, `resolved_at`. | `.enableRLS()`. Two regular policies now exist, added for self-service case submission (Profile → Report an Issue): a signed-in user can INSERT a case as themselves (`created_by = requester_id = auth.uid()`) and SELECT their own cases back (`requester_id = auth.uid()`) — enough to submit a report and see its status, not to see or write the comment thread, which stays service-role-only (case notes can still carry sensitive internal discussion). Everything else about this table (status changes, assignment, priority) is still admin-only, reached through the service-role client same as before. |
| `support_case_comments` | The comment/timeline thread on a case: `id`, `case_id` (→ `support_cases.id`, cascade delete), `author_id` (→ `profiles.id`), `body`, `created_at`. | Same as above — service-role-only. |
| `admin_audit_log` | Accountability trail for every admin *mutation* (not reads): `id`, `admin_id` (→ `profiles.id`), `action` (e.g. `"event.cancelled"`, `"vendor_claim.approved"`, `"profile.edited"`), `target_table`, `target_id`, `detail` (`jsonb` — a small before/after or reason payload), `created_at`. | Service-role-only, write-only from the app's perspective (every admin action that changes data writes one row here; nothing in the admin UI needs to read its own writes back mid-request). |

`assigned_admin_id`/`created_by` aren't constrained at the database level to actually hold an admin — enforcing "this FK must point at a row where `is_admin = true`" needs a trigger, not a plain FK, and isn't worth it yet: the admin-picker UI only ever offers real admins as options, and this is an internal tool, not a public-facing invariant. Revisit if that ever stops being true.

No changes needed to any existing table's RLS policies — the whole point of the service-role approach above is that admin access doesn't touch the policies already built for Planner/Vendor use.

---

## Route Inventory

All under `/admin` — a separate namespace from the consumer app, sharing no routes with it.

| Route | Purpose |
|---|---|
| `/admin` | Dashboard: counts (planners, vendors, events, open cases), a short recent-activity feed. |
| `/admin/planners` | Searchable/filterable list of every `profiles` row. |
| `/admin/planners/[id]` | One planner's detail: their events, collaborations, vendor memberships, case history. |
| `/admin/vendors` | Every vendor, filterable by verification status/category. |
| `/admin/vendors/[id]` | One vendor's detail: services, team, quotes, event associations, case history. Also where the Featured toggle lives (`vendors.is_featured`, added 2026-09-16 for the vendor marketplace redesign — see `gather_web_architecture.md`'s changelog) — the only real write path, since that column's own UPDATE grant deliberately excludes `authenticated` entirely. |
| `/admin/vendors/claims` | The claim-approval queue — this subsumes the "admin claim approve/reject" screen originally flagged (and left undecided) back in Phase 3/6; it lives here now instead of being built as a one-off inside Phase 6. |
| `/admin/events` | Every event regardless of owner, status, or visibility. |
| `/admin/events/[id]` | One event's detail: attendees, tasks, vendor associations, collaborators, moderation actions (e.g. cancel). |
| `/admin/cases` | The support case queue, filterable by status/priority/assignee. |
| `/admin/cases/new` | Log a new case by hand — the original admin-created path (a phone call, an email), still the only way to log a case with no known requester. |
| `/admin/cases/[id]` | Case detail + comment thread; also shows the reporter's chosen category and attachment, when the case came from the self-service form. |

No separate admin login: an admin is just a flagged `profiles` row, so `/login` (already built) is the only sign-in path. `requireAdmin()` is what actually decides whether `/admin/*` opens for that session, not a different auth flow.

The consumer-facing counterpart (`/profile/cases`, `/profile/cases/new`, `/profile/cases/[id]`) lives outside `/admin` entirely, in the regular mobile app shell — see `docs/gather_web_architecture.md`'s changelog for that feature. It reuses this phase's `support_cases` table and enum types but is otherwise a fully separate route tree with its own RLS-scoped (not service-role) queries, matching this doc's own "service-role client stays inside `src/app/admin/**`" rule.

---

## UI & Navigation — a deliberate exception to "mobile-first"

Every consumer-facing design principle in `gather_web_architecture.md` assumes a mobile-first, bottom-tab-bar product, because that's what Planners and Vendors actually are. Support staff using this console are not the target consumer, and dense data tables (a planner list, an event list with filters) are inherently a wide-viewport, desktop-oriented UI problem — trying to force the same mobile shell onto this would fight the content, not serve it. `/admin` gets its **own layout** (`src/app/admin/layout.tsx`): a left sidebar (`admin-sidebar.tsx`: Dashboard / Planners / Vendors / Events / Cases) instead of a bottom tab bar, and no persona switcher. It still visually reads as *Gather* — the same OKLCH tokens, the same fonts — just laid out for a laptop screen instead of a phone.

**Implementation note**: this is *not* a second Next.js root layout via route groups (the framework-native way to get a totally independent `<html>`/`<body>`) — that would have meant moving every existing consumer route under its own route group, a large, unnecessary refactor just to add one new section. Instead, `src/components/app-shell.tsx` (already a Client Component) checks `usePathname()` and, for any `/admin` path, skips rendering the mobile tab bar/persona-switcher/safe-area padding entirely and renders `{children}` (plus the shared toast system) directly — `/admin/layout.tsx` then supplies its own sidebar + content chrome inside that. Same single root `<html>`/`<body>`/font-loading as the rest of the app (which is exactly the "same tokens, same fonts" requirement above), just a client-side branch instead of a second physical layout tree.

---

## Security Notes

- **`requireAdmin()` at the top of every admin page and every admin Server Action, no exceptions** — never rely on the layout alone having gated navigation to a route.
- **Every mutation writes to `admin_audit_log`** — editing a planner's profile, cancelling an event, approving or rejecting a claim, resolving a case. A support tool that can directly edit user data without a "who changed what, when" trail is a real accountability gap for a CRM-style console, not a nice-to-have.
- **The service-role client stays entirely inside `/admin/*` and its Server Actions** — it must never be imported into any consumer-facing route. This is the same discipline already established for the guest-RSVP path in Phase 3, just with a much larger blast radius if it were ever misused, since admin's service-role usage is unrestricted by design.

---

## Where This Fits in the Roadmap

Proposed as **Phase 10**, after Polish & Hardening — see `gather_web_epic_roadmap.md`'s Epic/Phase Breakdown. It doesn't block Phases 6–9; nothing about the consumer product depends on it existing. The one piece of overlap: Phase 9's original scope included "the admin claim approve/reject back-office screen" as an undecided, possibly-deferred item — that item now lives here (`/admin/vendors/claims`) instead, so Phase 9 no longer needs to make that call itself.

## Open Questions (carried forward, not blocking)

1. **Role tiers within admin.** Today it's a single `is_admin` boolean — no "read-only support agent" vs. "full admin" distinction. Fine for a small, trusted internal team; revisit if the support team grows past a size where everyone having full edit access is comfortable.
2. ~~**Self-service case submission.**~~ **Done** — see `docs/gather_web_architecture.md`'s changelog ("Profile → Report an Issue"). A planner/vendor can now log a case directly (category, free text, optional screenshot) and see its status; the comment thread stays admin-only, which is a smaller follow-up worth doing if support ever needs to reply somewhere the reporter can see it.
3. **`phone` (and any future PII column) exposure on `profiles`.** Flagged again here because `is_admin`'s design was shaped by it: `profiles_select_all_authenticated`'s `using: true` is looser than it should be for any sensitive column. Not this phase's job to fix, but the `SECURITY DEFINER`-function pattern used for `is_admin` here is the template for whenever it is.
